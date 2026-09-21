let adminPassword = sessionStorage.getItem('hera_admin_pass') || '';

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

// ---------------- Productos ----------------
async function cargarProductosAdmin() {
  const res = await fetch('/api/admin/products', { headers: headersAdmin() });
  const productos = await res.json();
  const tbody = document.querySelector('#products-table tbody');
  tbody.innerHTML = productos.map(p => `
    <tr>
      <td><img src="${p.imageUrl}"></td>
      <td>${p.name}</td>
      <td>$${p.price}</td>
      <td>${p.stock}</td>
      <td><button class="btn btn-danger" onclick="borrarProducto('${p._id}')">Borrar</button></td>
    </tr>
  `).join('');
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('name', document.getElementById('p-name').value);
  fd.append('price', document.getElementById('p-price').value);
  fd.append('stock', document.getElementById('p-stock').value);
  fd.append('description', document.getElementById('p-desc').value);
  fd.append('image', document.getElementById('p-image').files[0]);

  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: headersAdmin(),
    body: fd
  });

  if (res.ok) {
    e.target.reset();
    cargarProductosAdmin();
  } else {
    alert('No se pudo guardar el producto');
  }
});

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

verificarSesion();
