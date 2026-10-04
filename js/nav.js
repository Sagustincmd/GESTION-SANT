// nav.js — Navegación entre páginas

function goTo(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (el) el.classList.add('active');
  if (page === 'home') cargarHome();
  if (page === 'inventario') cargarInventario();
  if (page === 'ventas') cargarVentas();
  if (page === 'gastos') cargarGastos();
  if (page === 'dashboard') cargarDashboard();
  if (page === 'reposicion') cargarReposicion();
  if (page === 'analisis') cargarAnalisis();
  if (page === 'inteligencia') cargarInteligencia();
  if (page === 'clientes') cargarClientes();
  if (page === 'devoluciones') cargarDevoluciones();
  if (page === 'deudores') cargarDeudores();
  if (page === 'movimientos') cargarMovimientos();
  if (page === 'compras') cargarCompras();
  if (page === 'caja') cargarCaja();
  if (page === 'scanner') cargarScanner();
}

function getProdTalle(id) { const p = allProductos.find(x => x.id === id); return p ? p.talle||'' : ''; }
function getProdColor(id) { const p = allProductos.find(x => x.id === id); return p ? p.color||'' : ''; }

// HOME
