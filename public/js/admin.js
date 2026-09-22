let adminPassword = sessionStorage.getItem('hera_admin_pass') || '';
let editingProductId = null;

function headersAdmin() {
  return { 'x-admin-password': adminPassword };
}

async function verificarSesion() {
  if (!adminPassword) {
    mostrarLogin();
    return;
  }
  const res = await fetch('/api/admin/products', { headers: headersAdmin() });
  if (res.status === 401) {
    sessionStorage.removeItem('hera_admin_pass');
    adminPassword = '';
    mostrarLogin();
  } else {
    mostrarPanel();
  }
}

function mostrarLogin() {
  document.getElementById('login-box').style.display = 'block';
  document.getElementById('panel').style.display = 'none';
}

function mostrarPanel() {
  document.getElementById('login-box').style.display = 'none';
  document.getElementById('panel').style.display = 'block';
  cargarProductosAdmin();
  cargarZonasAdmin();
  cargarOrdenes();
}

async function login() {
  const password = document.getElementById('password').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (res.ok) {
    adminPassword = password;
    sessionStorage.setItem('hera_admin_pass', password);
    mostrarPanel();
  } else {
    document.getElementById('login-error').textContent = 'Contraseña incorrecta';
  }
}

// ---------------- Mostrar/Ocultar campo de talles ----------------
function toggleSizesInput() {
  const category = document.getElementById('p-category').value;
  const sizesContainer = document.getElementById('sizes-container');
  sizesContainer.style.display = (category === 'anillo') ? 'block' : 'none';
}

// ---------------- Productos ----------------
async function cargarProductosAdmin() {
  const res = await fetch('/api/admin/products', { headers: headersAdmin() });
  const productos = await res.json();
  const tbody = document.querySelector('#products-table tbody');
  
  function getCategoryBadge(category) {
    const categories = {
      'anillo': '<span class="category-badge anillo">💍 Anillo</span>',
      'collar': '<span class="category-badge collares"> Collar</span>',
      'aro': '<span class="category-badge aros">✨ Aro</span>',
      'pulsera': '<span class="category-badge pulseras"> Pulsera</span>',
      'general': ''
    };
    return categories[category] || '';
  }
  
  tbody.innerHTML = productos.map(p => `
    <tr>
      <td><img src="${p.imageUrl}" alt="Producto"></td>
      <td>
        ${p.name}
        ${getCategoryBadge(p.category)}
        ${p.sizes && p.sizes.length > 0 ? `<br><small style="color:#666;">Talles: ${p.sizes.join(', ')}</small>` : ''}
      </td>
      <td>$${p.price}</td>
      <td>${p.stock}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-warning" onclick="editarProducto('${p._id}')">✏️ Editar</button>
          <button class="btn btn-danger" onclick="borrarProducto('${p._id}')">️ Borrar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// EDITAR producto (carga los datos en el formulario)
async function editarProducto(id) {
  try {
    const res = await fetch('/api/admin/products', { headers: headersAdmin() });
    const productos = await res.json();
    const p = productos.find(prod => prod._id === id);
    
    if (!p) return alert('Producto no encontrado');
    
    editingProductId = id;
    
    // Cargar datos en el formulario
    document.getElementById('p-id').value = p._id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-stock').value = p.stock;
    document.getElementById('p-category').value = p.category || 'general';
    document.getElementById('p-desc').value = p.description || '';
    document.getElementById('p-sizes').value = (p.sizes || []).join(', ');
    
    // Mostrar/ocultar campo de talles
    toggleSizesInput();
    
    // Cambiar título y botones
    document.getElementById('form-title').textContent = '✏️ Editando: ' + p.name;
    document.getElementById('btn-save').textContent = '💾 Guardar cambios';
    document.getElementById('btn-cancel').style.display = 'inline-block';
    document.getElementById('photo-hint').textContent = '(opcional - dejar vacío para mantener la actual)';
    document.getElementById('p-image').required = false;
    
    // Scroll al formulario
    document.getElementById('product-form').scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error('Error al cargar producto:', error);
    alert('Error al cargar el producto');
  }
}

// Cancelar edición
function cancelEdit() {
  editingProductId = null;
  document.getElementById('product-form').reset();
  document.getElementById('p-id').value = '';
  document.getElementById('form-title').textContent = 'Agregar producto';
  document.getElementById('btn-save').textContent = 'Guardar producto';
  document.getElementById('btn-cancel').style.display = 'none';
  document.getElementById('photo-hint').textContent = '(obligatoria para nuevos)';
  document.getElementById('p-image').required = true;
  toggleSizesInput();
}

// Submit del formulario (crear o editar)
const productForm = document.getElementById('product-form');
if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fd = new FormData();
    fd.append('name', document.getElementById('p-name').value);
    fd.append('price', document.getElementById('p-price').value);
    fd.append('stock', document.getElementById('p-stock').value);
    fd.append('description', document.getElementById('p-desc').value);
    
    const category = document.getElementById('p-category').value;
    fd.append('category', category);
    
    if (category === 'anillo') {
      const sizesInput = document.getElementById('p-sizes').value.trim();
      if (sizesInput) {
        const sizes = sizesInput.split(',').map(s => s.trim()).filter(s => s);
        fd.append('sizes', JSON.stringify(sizes));
      }
    }
    
    const imageFile = document.getElementById('p-image').files[0];
    
    let res;
    if (editingProductId) {
      // MODO EDICIÓN
      if (imageFile) fd.append('image', imageFile);
      res = await fetch('/api/admin/products/' + editingProductId, {
        method: 'PUT',
        headers: headersAdmin(),
        body: fd
      });
    } else {
      // MODO CREAR
      if (!imageFile) return alert('La foto es obligatoria para nuevos productos');
      fd.append('image', imageFile);
      res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: headersAdmin(),
        body: fd
      });
    }
    
    if (res.ok) {
      cancelEdit();
      cargarProductosAdmin();
      alert(editingProductId ? '✅ Producto actualizado correctamente' : '✅ Producto creado correctamente');
    } else {
      const error = await res.json();
      alert('Error: ' + error.error);
    }
  });
}

async function borrarProducto(id) {
  if (!confirm('¿Borrar este producto?')) return;
  await fetch('/api/admin/products/' + id, { method: 'DELETE', headers: headersAdmin() });
  cargarProductosAdmin();
}

// ---------------- Zonas de envio ----------------
async function cargarZonasAdmin() {
  const res = await fetch('/api/shipping-zones');
  const zonas = await res.json();
  const tbody = document.querySelector('#zones-table tbody');
  tbody.innerHTML = zonas.map(z => `
    <tr>
      <td>${z.name}</td>
      <td>$${z.cost}</td>
      <td><button class="btn btn-danger" onclick="borrarZona('${z._id}')">Borrar</button></td>
    </tr>
  `).join('');
}

async function agregarZona() {
  const name = document.getElementById('z-name').value.trim();
  const cost = document.getElementById('z-cost').value;
  if (!name || !cost) return alert('Completá nombre y costo');
  await fetch('/api/admin/shipping-zones', {
    method: 'POST',
    headers: { ...headersAdmin(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, cost })
  });
  document.getElementById('z-name').value = '';
  document.getElementById('z-cost').value = '';
  cargarZonasAdmin();
}

async function borrarZona(id) {
  if (!confirm('¿Borrar esta zona?')) return;
  await fetch('/api/admin/shipping-zones/' + id, { method: 'DELETE', headers: headersAdmin() });
  cargarZonasAdmin();
}

// ---------------- Ordenes ----------------
async function cargarOrdenes() {
  const res = await fetch('/api/admin/orders', { headers: headersAdmin() });
  const ordenes = await res.json();
  const tbody = document.querySelector('#orders-table tbody');
  tbody.innerHTML = ordenes.map(o => `
    <tr>
      <td>${new Date(o.createdAt).toLocaleString('es-AR')}</td>
      <td>${o.buyerName || '-'} (${o.buyerEmail || '-'})</td>
      <td>$${o.total}</td>
      <td>${o.status}</td>
    </tr>
  `).join('');
}

// ---------------- Actualización Masiva de Precios (Excel) ----------------
const uploadPricesForm = document.getElementById('upload-prices-form');
if (uploadPricesForm) {
  uploadPricesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('prices-file');
    const resultDiv = document.getElementById('upload-result');
    const btn = document.getElementById('btn-update-prices');
    
    if (!fileInput.files[0]) return alert('Por favor seleccioná un archivo Excel');
    
    btn.disabled = true;
    btn.textContent = '⏳ Procesando...';
    resultDiv.innerHTML = '<p style="color: #007bff; margin-top: 15px;">Subiendo y procesando archivo...</p>';
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
      const res = await fetch('/api/admin/update-prices', {
        method: 'POST',
        headers: headersAdmin(),
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        resultDiv.innerHTML = `
          <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 6px; border: 1px solid #c3e6cb; margin-top: 15px;">
            <strong>✅ ¡Actualización completada!</strong><br>
            Productos actualizados: ${data.message}<br>
            ${data.notFound > 0 ? `<span style="color: #856404;">⚠️ No encontrados: ${data.notFound}</span><br>` : ''}
            ${data.errors && data.errors.length > 0 ? `<small>Detalles: ${data.errors.join(', ')}</small>` : ''}
          </div>`;
        fileInput.value = '';
        cargarProductosAdmin();
      } else {
        resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 6px; border: 1px solid #f5c6cb; margin-top: 15px;"><strong>❌ Error:</strong> ${data.error}</div>`;
      }
    } catch (error) {
      resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 6px; border: 1px solid #f5c6cb; margin-top: 15px;"><strong> Error de conexión:</strong> ${error.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '📤 Actualizar Precios';
    }
  });
}

verificarSesion();
