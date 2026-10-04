// config.js — Configuración global Santos Brother

const SUPABASE_URL = "https://aalgxsfqfyskvqamxtqd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhbGd4c2ZxZnlza3ZxYW14dHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzQ5NzgsImV4cCI6MjA5NTk1MDk3OH0.BfGBbcOLgPMeO1U8tR7mUO3Vfr0AoqCURE9CjYlxud8";
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Estado global
const USUARIOS_CORDOBA = ['joackoloza17@gmail.com'];
let currentUser = null;
let currentSucursal = 'Laboulaye';
let esAdmin = true;

let allProductos = [], allVentas = [], allGastos = [];
let allClientes = [];
let allDeudores = [];
let allDeudoresPagos = [];
let todasCompras = [];
let compPresupuesto = 0;

let invFiltrado = [], ventaFiltro = 'hoy', ventaMesEspecifico = '', dashFiltro = 'mes';
let adminSucursalFiltro = 'todas';
let chartFact = null, chartGan = null;
let homeChartsInit = false;
let intelTabActual = 'repo';
let rotacionChartsInit = false;
let cliFiltro = 'todos';
let deuFiltro = 'todos';
let movFiltro = 'todos';
let cajaFechaActual = '';
let chartCaja = null;
let scannerProductos = [];
let scanTimer = null;

const INV_TALLES = [34,35,36,37,38,39,40,41,42,43,44,45];
const CLI_AVATAR_COLORS = ['var(--green-bg)','var(--blue-bg)','#2e1065','var(--yellow-bg)'];

function getSucursalFiltro() { return esAdmin ? null : currentSucursal; }
function sbEndpointConSucursal(endpoint) {
  if (esAdmin) return endpoint;
  const sep = endpoint.includes('?') ? '&' : '?';
  return endpoint + sep + 'sucursal=eq.' + currentSucursal;
}

function toast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${type} show`;
  setTimeout(() => el.className = 'toast', 3000);
}
