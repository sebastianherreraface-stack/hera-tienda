require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

// Instancia de multer SOLO para subir el Excel localmente (sin Cloudinary)
const uploadLocal = multer({ dest: 'uploads/' });

const Product = require('./models/Product');
const ShippingZone = require('./models/ShippingZone');
const Order = require('./models/Order');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- MongoDB ----------------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err.message));

// ---------------- Cloudinary ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'hera-tienda', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] }
});
const upload = multer({ storage });

// ---------------- Mercado Pago ----------------
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// ---------------- Mail ----------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

async function avisarVenta(order) {
  const itemsTxt = order.items.map(i => `- ${i.name} x${i.quantity} = $${(i.price * i.quantity).toFixed(2)}`).join('\n');
  const texto = `Nueva venta confirmada en Hera\n\n${itemsTxt}\n\nEnvio (${order.shippingZone}): $${order.shippingCost}\nTOTAL: $${order.total}\n\nComprador: ${order.buyerName || '-'}\nEmail: ${order.buyerEmail || '-'}\nDireccion: ${order.buyerAddress || '-'}\n\nID de pago MP: ${order.mpPaymentId}`;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFY_EMAIL,
      subject: `Nueva venta - Hera - $${order.total}`,
      text: texto
    });
  } catch (e) {
    console.error('Error enviando mail de aviso:', e.message);
  }
}

// ---------------- Middleware admin ----------------
function requireAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (pass && pass === process.env.ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'No autorizado' });
}

// ================== RUTAS PUBLICAS ==================

app.get('/api/products', async (req, res) => {
  const products = await Product.find({ active: true }).sort({ createdAt: -1 });
  res.json(products);
});

app.get('/api/shipping-zones', async (req, res) => {
  const zones = await ShippingZone.find().sort({ name: 1 });
  res.json(zones);
});

// Crea la preferencia de pago y devuelve el link de Mercado Pago
app.post('/api/create-preference', async (req, res) => {
  try {
    const { items, shippingZoneId, buyerEmail, buyerName, buyerAddress } = req.body;

    if (!items || !items.length) return res.status(400).json({ error: 'Carrito vacio' });

    const zone = await ShippingZone.findById(shippingZoneId);
    if (!zone) return res.status(400).json({ error: 'Zona de envio invalida' });

    // Traemos los productos reales de la base para no confiar en precios que mande el navegador
    const ids = items.map(i => i.productId);
    const dbProducts = await Product.find({ _id: { $in: ids } });

    const mpItems = [];
    let total = 0;
    const orderItems = [];

    for (const it of items) {
      const p = dbProducts.find(dp => dp._id.toString() === it.productId);
      if (!p) continue;
      const qty = Math.max(1, parseInt(it.quantity) || 1);
      
      // Agregar el tamaño al título si existe (para anillos)
      const title = p.name + (it.size ? ` (Medida: ${it.size})` : '');
      
      mpItems.push({
        id: p._id.toString(),
        title: title,
        quantity: qty,
        unit_price: p.price,
        currency_id: 'ARS'
      });
      total += p.price * qty;
      orderItems.push({ 
        productId: p._id.toString(), 
        name: p.name, 
        price: p.price, 
        quantity: qty,
        size: it.size || null
      });
    }

    mpItems.push({
      id: 'envio',
      title: `Envio - ${zone.name}`,
      quantity: 1,
      unit_price: zone.cost,
      currency_id: 'ARS'
    });
    total += zone.cost;

    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: mpItems,
        payer: { email: buyerEmail },
        back_urls: {
          success: `${process.env.SITE_URL}/gracias.html`,
          failure: `${process.env.SITE_URL}/index.html`,
          pending: `${process.env.SITE_URL}/index.html`
        },
        auto_return: 'approved',
        notification_url: `${process.env.SITE_URL}/api/webhook`,
        metadata: {
          items: orderItems,
          shippingZone: zone.name,
          shippingCost: zone.cost,
          total,
          buyerEmail,
          buyerName,
          buyerAddress
        }
      }
    });

    res.json({ init_point: result.init_point });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear el pago' });
  }
});

// Mercado Pago llama aca cuando cambia el estado de un pago
app.post('/api/webhook', async (req, res) => {
  try {
    const paymentId = req.query['data.id'] || req.body?.data?.id;
    const topic = req.query.topic || req.body?.type;

    if (topic === 'payment' && paymentId) {
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: paymentId });

      if (payment.status === 'approved') {
        const meta = payment.metadata || {};
        const order = await Order.create({
          items: meta.items || [],
          shippingZone: meta.shipping_zone || meta.shippingZone,
          shippingCost: meta.shipping_cost || meta.shippingCost,
          total: meta.total,
          buyerEmail: meta.buyer_email || meta.buyerEmail,
          buyerName: meta.buyer_name || meta.buyerName,
          buyerAddress: meta.buyer_address || meta.buyerAddress,
          mpPaymentId: paymentId,
          status: 'approved'
        });
        await avisarVenta(order);
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('Error en webhook:', e.message);
    res.sendStatus(200); // igual respondemos 200 para que MP no reintente indefinidamente
  }
});

// ================== RUTAS ADMIN (protegidas) ==================

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

app.post('/api/admin/products', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, stock, category, sizes } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Falta la foto' });
    
    // Parsear sizes si viene como string JSON
    let sizesArray = [];
    if (sizes) {
      try {
        sizesArray = JSON.parse(sizes);
      } catch (e) {
        sizesArray = sizes.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    
    const product = await Product.create({
      name,
      price: parseFloat(price),
      description: description || '',
      stock: stock ? parseInt(stock) : 999,
      category: category || 'general',
      sizes: sizesArray,
      imageUrl: req.file.path,
      imagePublicId: req.file.filename
    });
    res.json(product);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear el producto' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, stock, category, sizes, active } = req.body;
    
    // Parsear sizes si viene como string JSON
    let sizesArray = [];
    if (sizes) {
      try {
        sizesArray = JSON.parse(sizes);
      } catch (e) {
        sizesArray = sizes.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    
    const update = { 
      name, 
      price: parseFloat(price), 
      description, 
      stock: parseInt(stock), 
      active: active !== 'false',
      category: category || 'general',
      sizes: sizesArray
    };
    
    if (req.file) {
      update.imageUrl = req.file.path;
      update.imagePublicId = req.file.filename;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(product);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo actualizar' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product?.imagePublicId) {
      await cloudinary.uploader.destroy(product.imagePublicId).catch(() => {});
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo borrar' });
  }
});

// --- zonas de envio ---
app.post('/api/admin/shipping-zones', requireAdmin, async (req, res) => {
  const { name, cost } = req.body;
  const zone = await ShippingZone.create({ name, cost: parseFloat(cost) });
  res.json(zone);
});

app.put('/api/admin/shipping-zones/:id', requireAdmin, async (req, res) => {
  const { name, cost } = req.body;
  const zone = await ShippingZone.findByIdAndUpdate(req.params.id, { name, cost: parseFloat(cost) }, { new: true });
  res.json(zone);
});

app.delete('/api/admin/shipping-zones/:id', requireAdmin, async (req, res) => {
  await ShippingZone.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
  res.json(orders);
});

// ================== RUTA PARA ACTUALIZAR PRECIOS CON EXCEL (MEJORADA) ==================
app.post('/api/admin/update-prices', requireAdmin, uploadLocal.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        // 1. Leer el archivo Excel
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log('📊 DATOS LEÍDOS DEL EXCEL:', JSON.stringify(data, null, 2));

        // 🗄️ LOG: Mostrar TODOS los productos de la base de datos para comparar
        const todosLosProductos = await Product.find({});
        console.log('🗄️ PRODUCTOS EN LA BASE DE DATOS:');
        todosLosProductos.forEach(p => {
            console.log(`   - ID: ${p._id} | Nombre: "${p.name}" | Precio: ${p.price}`);
        });

        let updatedCount = 0;
        let notFoundCount = 0;
        const errors = [];

        // 2. Recorrer cada fila del Excel
        for (const row of data) {
            let product = null;
            
            console.log('🔍 Procesando fila:', row);

            // Si tiene SKU, busca por SKU exacto
            if (row.sku) {
                product = await Product.findOne({ sku: String(row.sku).trim() });
            }
            
            // 🆕 Búsqueda más flexible por nombre (usa includes en lugar de regex exacto)
            if (!product && row.nombre) {
                const nombreLimpio = String(row.nombre).trim().toLowerCase();
                console.log('🔎 Buscando producto con nombre limpio:', `"${nombreLimpio}"`);
                
                // Buscar en todos los productos el que tenga el nombre similar
                for (const p of todosLosProductos) {
                    const nombreDB = String(p.name).trim().toLowerCase();
                    if (nombreDB === nombreLimpio || nombreDB.includes(nombreLimpio) || nombreLimpio.includes(nombreDB)) {
                        product = p;
                        console.log('✅ Producto encontrado por similitud:', p.name);
                        break;
                    }
                }
            }
            
            if (product && row.precio) {
                product.price = Number(row.precio);
                await product.save();
                updatedCount++;
                console.log('✅ Actualizado:', product.name, 'a', product.price);
            } else {
                notFoundCount++;
                const errorMsg = `No encontrado o sin precio: ${row.sku || row.nombre}`;
                errors.push(errorMsg);
                console.log('❌', errorMsg);
            }
        }

        // 3. Borrar el archivo temporal
        fs.unlinkSync(req.file.path);

        // 4. Enviar respuesta al frontend
        res.json({
            success: true,
            message: `${updatedCount} productos actualizados`,
            notFound: notFoundCount,
            errors: errors.slice(0, 5)
        });

    } catch (error) {
        console.error('❌ Error al actualizar precios:', error);
        res.status(500).json({ error: 'Error interno del servidor al procesar el Excel' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hera tienda corriendo en puerto ${PORT}`));
