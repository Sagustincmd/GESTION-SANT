// auth.js — Autenticación y manejo de sucursales

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhbGd4c2ZxZnlza3ZxYW14dHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzQ5NzgsImV4cCI6MjA5NTk1MDk3OH0.BfGBbcOLgPMeO1U8tR7mUO3Vfr0AoqCURE9CjYlxud8";
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// SUCURSALES
const USUARIOS_CORDOBA = ['joackoloza17@gmail.com'];
let currentUser = null;
let currentSucursal = 'Laboulaye'; // default
let esAdmin = true;

function getSucursalFiltro() {
  return esAdmin ? null : currentSucursal;
}

function sbEndpointConSucursal(endpoint) {
  if (esAdmin) return endpoint;
  const sep = endpoint.includes('?') ? '&' : '?';
  return endpoint + sep + 'sucursal=eq.' + currentSucursal;
}

const sb = async (endpoint, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': opts.prefer || '', ...opts.headers },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  if (opts.method === 'DELETE' || opts.prefer === 'return=minimal') return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : null;
};

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-AR');
const fmtN = n => Math.round(n || 0).toLocaleString('es-AR');
const today = () => new Date().toISOString().split('T')[0];
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };

let allProductos = [], allVentas = [], allGastos = [];
let invFiltrado = [], ventaFiltro = 'hoy', ventaMesEspecifico = '', dashFiltro = 'mes';
let adminSucursalFiltro = 'todas';
let chartFact = null, chartGan = null;

function toast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${type} show`;
  setTimeout(() => el.className = 'toast', 3000);
}

// AUTH
async function loginSubmit() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  btn.textContent = 'Ingresando...'; btn.disabled = true;
  const { data, error } = await sbClient.auth.signInWithPassword({ email, password: pass });
  btn.textContent = 'Ingresar'; btn.disabled = false;
  if (error) { errEl.textContent = 'Email o contraseña incorrectos'; return; }
  mostrarApp(data.user);
}

function mostrarApp(user) {
  currentUser = user;
  esAdmin = !USUARIOS_CORDOBA.includes(user.email);
  currentSucursal = USUARIOS_CORDOBA.includes(user.email) ? 'Córdoba' : 'Laboulaye';

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('sidebar-email').textContent = user.email;

  // Mostrar badge de sucursal
  const badge = document.getElementById('sucursal-badge');
  if (badge) {
    badge.textContent = currentSucursal;
    badge.style.background = esAdmin ? 'var(--green-bg)' : 'var(--yellow-bg)';
    badge.style.color = esAdmin ? 'var(--green)' : 'var(--yellow)';
  }

  // Ocultar páginas para Joaquín
  if (!esAdmin) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }

  // Agregar filtro de sucursal para admin
  if (esAdmin) {
    const filtroEl = document.getElementById('admin-sucursal-filter');
    if (filtroEl) filtroEl.style.display = 'flex';
  }

  cargarHome();
}

async function cerrarSesion() {
  await sbClient.auth.signOut();
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
}

// NAV
