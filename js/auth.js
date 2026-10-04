// auth.js — Autenticación y sucursales

// SUCURSALES

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
