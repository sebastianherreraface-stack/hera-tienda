let productos = [];
let zonas = [];
let carrito = JSON.parse(localStorage.getItem('hera_carrito') || '[]');

function guardarCarrito() {
  localStorage.setItem('hera_carrito', JSON.stringify(carrito));
  actualizarContador();
}

function actualizarContador() {
  const total = carrito.reduce((s, i) => s + i.quantity, 0);
  document.getElementById('cart-count').textContent = total;
}

// ---------------- Cargar productos ----------------
async function cargarProductos() {
  const res = await fetch('/api/products');
  productos = await res.json();
  const grid = document.getElementById('grid');
  grid.innerHTML = productos.map(p => `
    <div class="card">
      <img src="${p.imageUrl}" alt="${p.name}">
      <div class="card-body">
        <h3>${p.name}</h3>
        <div class="precio">$${p.price.toLocaleString('es-AR')}</div>
        <button onclick="agregarAlCarrito('${p._id}')">Agregar al carrito</button>
      </div>
    </div>
  `).join('');
}

// ---------------- Cargar zonas de envio ----------------
async function cargarZonas() {
  const res = await fetch('/api/shipping-zones');
  zonas = await res.json();
  const select = document.getElementById('shipping-zone');
  select.innerHTML = zonas.map(z => `<option value="${z._id}">${z.name} - $${z.cost}</option>`).join('');
  select.addEventListener('change', renderCarrito);
}

// ---------------- Carrito ----------------
function agregarAlCarrito(id) {
  const existente = carrito.find(i => i.productId === id);
  if (existente) existente.quantity += 1;
  else carrito.push({ productId: id, quantity: 1 });
  guardarCarrito();
  abrirCarrito();
}

function cambiarCantidad(id, delta) {
  const item = carrito.find(i => i.productId === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) carrito = carrito.filter(i => i.productId !== id);
  guardarCarrito();
  renderCarrito();
}

function quitarDelCarrito(id) {
  carrito = carrito.filter(i => i.productId !== id);
  guardarCarrito();
  renderCarrito();
}

function renderCarrito() {
  const cont = document.getElementById('cart-items');

  if (carrito.length === 0) {
    cont.innerHTML = '<p class="vacio">Tu carrito está vacío</p>';
  } else {
    cont.innerHTML = carrito.map(item => {
      const p = productos.find(pr => pr._id === item.productId);
      if (!p) return '';
      return `
        <div class="cart-item">
          <img src="${p.imageUrl}">
          <div class="info">
            <div>${p.name}</div>
            <div class="qty-controls">
              <button onclick="cambiarCantidad('${p._id}', -1)">-</button>
              <span>${item.quantity}</span>
              <button onclick="cambiarCantidad('${p._id}', 1)">+</button>
            </div>
            <div class="remove" onclick="quitarDelCarrito('${p._id}')">Quitar</div>
          </div>
          <div>$${(p.price * item.quantity).toLocaleString('es-AR')}</div>
        </div>
      `;
    }).join('');
  }

  const subtotal = carrito.reduce((s, item) => {
    const p = productos.find(pr => pr._id === item.productId);
    return s + (p ? p.price * item.quantity : 0);
  }, 0);

  const zonaId = document.getElementById('shipping-zone').value;
  const zona = zonas.find(z => z._id === zonaId);
  const costoEnvio = zona ? zona.cost : 0;

  document.getElementById('subtotal').textContent = '$' + subtotal.toLocaleString('es-AR');
  document.getElementById('shipping-cost').textContent = '$' + costoEnvio.toLocaleString('es-AR');
  document.getElementById('total').textContent = '$' + (subtotal + costoEnvio).toLocaleString('es-AR');

  document.getElementById('checkout-btn').disabled = carrito.length === 0;
}

function abrirCarrito() {
  renderCarrito();
  document.getElementById('cart-overlay').classList.add('open');
}
function cerrarCarrito() {
  document.getElementById('cart-overlay').classList.remove('open');
}

document.getElementById('cart-btn').addEventListener('click', abrirCarrito);
document.getElementById('cart-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'cart-overlay') cerrarCarrito();
});

// ---------------- Checkout ----------------
document.getElementById('checkout-btn').addEventListener('click', async () => {
  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerEmail = document.getElementById('buyer-email').value.trim();
  const buyerAddress = document.getElementById('buyer-address').value.trim();
  const shippingZoneId = document.getElementById('shipping-zone').value;

  if (!buyerName || !buyerEmail || !buyerAddress) {
    alert('Completá nombre, email y dirección antes de continuar.');
    return;
  }

  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.textContent = 'Generando pago...';

  try {
    const res = await fetch('/api/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: carrito, shippingZoneId, buyerEmail, buyerName, buyerAddress })
    });
    const data = await res.json();
    if (data.init_point) {
      localStorage.removeItem('hera_carrito');
      window.location.href = data.init_point;
    } else {
      alert('No se pudo generar el pago. Probá de nuevo.');
      btn.disabled = false;
      btn.textContent = 'Pagar con Mercado Pago';
    }
  } catch (e) {
    alert('Error de conexión. Probá de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Pagar con Mercado Pago';
  }
});

// ---------------- Inicio ----------------
cargarProductos();
cargarZonas().then(renderCarrito);
actualizarContador();
