let cart = [];
let currentProduct = null;
let currentQuantity = 1;

// Cargar datos al iniciar la página
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  await loadShippingZones();
  updateCartUI();
  setupEventListeners();
});

function setupEventListeners() {
  // Abrir carrito
  document.getElementById('cart-btn').addEventListener('click', () => {
    document.getElementById('cart-overlay').classList.add('active');
  });

  // Cerrar carrito al hacer clic fuera
  document.getElementById('cart-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'cart-overlay') {
      document.getElementById('cart-overlay').classList.remove('active');
    }
  });

  // Actualizar total cuando cambia la zona de envío
  document.getElementById('shipping-zone').addEventListener('change', updateCartUI);

  // Botón de pago
  document.getElementById('checkout-btn').addEventListener('click', checkout);
}

// Cargar productos desde el backend
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const products = await res.json();
    
    const grid = document.getElementById('grid');
    if (!grid) return;
    
    grid.innerHTML = products.map(p => `
      <div class="product-card" onclick="openProductModal('${p._id}')" style="cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
        <img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 8px 8px 0 0;">
        <div style="padding: 16px;">
          <h3 style="margin: 0 0 8px; font-family: Georgia, serif; font-size: 18px;">${p.name}</h3>
          <p style="color: var(--dorado, #b8860b); font-size: 20px; font-weight: bold; margin: 0;">$${p.price}</p>
          ${p.category === 'anillo' ? '<span style="display: inline-block; margin-top: 8px; background: #ffe0b2; color: #e65100; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">💍 Disponible en talles</span>' : ''}
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error cargando productos:', error);
  }
}

// Cargar zonas de envío
async function loadShippingZones() {
  try {
    const res = await fetch('/api/shipping-zones');
    const zones = await res.json();
    
    const select = document.getElementById('shipping-zone');
    if (select) {
      select.innerHTML = '<option value="">Seleccionar zona de envío...</option>' + 
        zones.map(z => `<option value="${z._id}" data-cost="${z.cost}">${z.name} - $${z.cost}</option>`).join('');
    }
  } catch (error) {
    console.error('Error cargando zonas:', error);
  }
}

// Abrir modal del producto
async function openProductModal(productId) {
  try {
    const res = await fetch('/api/products');
    const products = await res.json();
    const product = products.find(p => p._id === productId);
    
    if (!product) return;
    
    currentProduct = product;
    currentQuantity = 1; // Resetear cantidad
    
    // Llenar datos del modal
    document.getElementById('modal-img').src = product.imageUrl;
    document.getElementById('modal-name').textContent = product.name;
    document.getElementById('modal-price').textContent = `$${product.price}`;
    document.getElementById('modal-desc').textContent = product.description || 'Sin descripción disponible.';
    document.getElementById('quantity-display').textContent = currentQuantity;
    
    // Mostrar categoría si existe
    const categoryBadge = document.getElementById('modal-category');
    if (product.category && product.category !== 'general') {
      categoryBadge.style.display = 'inline-block';
      categoryBadge.textContent = product.category.charAt(0).toUpperCase() + product.category.slice(1);
    } else {
      categoryBadge.style.display = 'none';
    }
    
    // Manejar selector de talles
    const sizeSelector = document.getElementById('size-selector');
    const sizeSelect = document.getElementById('product-size');
    const sizeError = document.getElementById('size-error');
    
    sizeError.style.display = 'none'; // Ocultar error previo
    
    if (product.category === 'anillo' && product.sizes && product.sizes.length > 0) {
      sizeSelector.style.display = 'block';
      sizeSelect.innerHTML = '<option value="">Seleccionar medida...</option>';
      product.sizes.forEach(size => {
        sizeSelect.innerHTML += `<option value="${size}">Medida ${size}</option>`;
      });
    } else {
      sizeSelector.style.display = 'none';
      sizeSelect.value = '';
    }
    
    // Mostrar modal
    document.getElementById('product-modal').classList.add('active');
    
  } catch (error) {
    console.error('Error abriendo modal:', error);
  }
}

// Cerrar modal
function closeModal() {
  document.getElementById('product-modal').classList.remove('active');
  currentProduct = null;
  currentQuantity = 1;
}

// Cambiar cantidad en el modal
function changeQuantity(delta) {
  currentQuantity += delta;
  if (currentQuantity < 1) currentQuantity = 1;
  document.getElementById('quantity-display').textContent = currentQuantity;
}

// Agregar al carrito
function addToCart() {
  if (!currentProduct) return;
  
  const sizeSelector = document.getElementById('size-selector');
  const sizeSelect = document.getElementById('product-size');
  const sizeError = document.getElementById('size-error');
  
  // Validar talle si es anillo
  if (sizeSelector.style.display !== 'none') {
    if (!sizeSelect.value) {
      sizeError.style.display = 'block';
      return; // No agregar al carrito
    }
  }
  
  sizeError.style.display = 'none';
  
  const cartItem = {
    productId: currentProduct._id,
    name: currentProduct.name,
    price: currentProduct.price,
    quantity: currentQuantity,
    size: sizeSelect.value || null,
    image: currentProduct.imageUrl
  };
  
  // Verificar si ya existe el mismo producto con el mismo talle
  const existingIndex = cart.findIndex(item => 
    item.productId === cartItem.productId && item.size === cartItem.size
  );
  
  if (existingIndex !== -1) {
    cart[existingIndex].quantity += currentQuantity;
  } else {
    cart.push(cartItem);
  }
  
  updateCartUI();
  closeModal();
  
  // Abrir el carrito automáticamente para confirmar
  document.getElementById('cart-overlay').classList.add('active');
}

// Actualizar la interfaz del carrito
function updateCartUI() {
  const cartCount = document.getElementById('cart-count');
  const cartItems = document.getElementById('cart-items');
  
  // Actualizar contador
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCount) cartCount.textContent = totalItems;
  
  // Renderizar items
  if (cartItems) {
    if (cart.length === 0) {
      cartItems.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Tu carrito está vacío 💎</p>';
    } else {
      cartItems.innerHTML = cart.map((item, index) => `
        <div style="display: flex; gap: 15px; padding: 15px 0; border-bottom: 1px solid #eee; align-items: center;">
          <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 5px; font-family: Georgia, serif; font-size: 15px;">${item.name}</h4>
            ${item.size ? `<small style="color: #666; display: block; margin-bottom: 4px;">💍 Medida: ${item.size}</small>` : ''}
            <small style="color: var(--dorado, #b8860b); font-weight: bold;">$${item.price} c/u</small>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button onclick="updateCartItemQuantity(${index}, -1)" style="width: 28px; height: 28px; border: 1px solid #ddd; background: white; cursor: pointer; border-radius: 4px; font-weight: bold;">-</button>
            <span style="min-width: 25px; text-align: center; font-weight: bold;">${item.quantity}</span>
            <button onclick="updateCartItemQuantity(${index}, 1)" style="width: 28px; height: 28px; border: 1px solid #ddd; background: white; cursor: pointer; border-radius: 4px; font-weight: bold;">+</button>
          </div>
          <button onclick="removeFromCart(${index})" style="background: none; border: none; color: #c0392b; font-size: 20px; cursor: pointer; padding: 0 5px;">×</button>
        </div>
      `).join('');
    }
  }
  
  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingSelect = document.getElementById('shipping-zone');
  const shippingCost = shippingSelect?.selectedOptions[0]?.dataset?.cost ? parseFloat(shippingSelect.selectedOptions[0].dataset.cost) : 0;
  const total = subtotal + shippingCost;
  
  document.getElementById('subtotal').textContent = `$${subtotal}`;
  document.getElementById('shipping-cost').textContent = shippingCost > 0 ? `$${shippingCost}` : '$0';
  document.getElementById('total').textContent = `$${total}`;
}

// Actualizar cantidad desde el carrito
function updateCartItemQuantity(index, delta) {
  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  updateCartUI();
}

// Eliminar del carrito
function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartUI();
}

// Procesar pago (Checkout)
async function checkout() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío');
    return;
  }
  
  const shippingZone = document.getElementById('shipping-zone').value;
  if (!shippingZone) {
    alert('Por favor seleccioná una zona de envío');
    return;
  }
  
  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerEmail = document.getElementById('buyer-email').value.trim();
  const buyerAddress = document.getElementById('buyer-address').value.trim();
  
  if (!buyerName || !buyerEmail || !buyerAddress) {
    alert('Por favor completá todos tus datos de envío (Nombre, Email y Dirección)');
    return;
  }
  
  // Deshabilitar botón mientras procesa
  const checkoutBtn = document.getElementById('checkout-btn');
  const originalText = checkoutBtn.textContent;
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = '⏳ Procesando...';
  
  try {
    const res = await fetch('/api/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart,
        shippingZoneId: shippingZone,
        buyerEmail,
        buyerName,
        buyerAddress
      })
    });
    
    const data = await res.json();
    
    if (data.init_point) {
      window.location.href = data.init_point; // Redirigir a Mercado Pago
    } else {
      alert('Error al crear el pago: ' + (data.error || 'Desconocido'));
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = originalText;
    }
  } catch (error) {
    console.error('Error en checkout:', error);
    alert('Error de conexión al procesar el pago. Intentá de nuevo.');
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = originalText;
  }
}
