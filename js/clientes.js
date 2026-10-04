// clientes.js — CRM de clientes

let cliFiltro = 'todos';

const CLI_AVATAR_COLORS = ['var(--green-bg)','var(--blue-bg)','#2e1065','var(--yellow-bg)'];

function getIniciales(nombre) { return (nombre||'').split(' ').slice(0,2).map(n=>n[0]||'').join('').toUpperCase(); }
function getEdad(nac) {
  if (!nac) return null;
  const h = new Date(), n = new Date(nac);
  let e = h.getFullYear()-n.getFullYear();
  if (h.getMonth()<n.getMonth()||(h.getMonth()===n.getMonth()&&h.getDate()<n.getDate())) e--;
  return e;
}
function esCumpleHoy(nac) {
  if (!nac) return false;
  const h = new Date(), n = new Date(nac);
  return h.getMonth()===n.getMonth()&&h.getDate()===n.getDate();
}
function getCliEstado(c, comprasCliente) {
  if (c.estado === 'vip' || comprasCliente.length >= 4) return { label:'⭐ VIP', bg:'#2e1065', color:'var(--purple)' };
  if (c.estado === 'recurrente' || comprasCliente.length >= 2) return { label:'✓ Recurrente', bg:'var(--green-bg)', color:'var(--green)' };
  if (c.estado === 'inactivo') return { label:'Inactivo', bg:'var(--surface2)', color:'var(--text3)' };
  return { label:'🆕 Nuevo', bg:'var(--blue-bg)', color:'var(--blue)' };
}

async function cargarClientes() {
  const suf = esAdmin ? '' : '&sucursal=eq.' + currentSucursal;
  allClientes = await sb('clientes?select=*&order=registrado_en.desc' + suf) || [];
  if (!allVentas.length) allVentas = await sb('ventas?select=*' + suf) || [];
  renderCliStats();
  filtrarClientes();
}

function getComprasCliente(clienteId) {
  return allVentas.filter(v => v.cliente_id === clienteId);
}

function renderCliStats() {
  const total = allClientes.length;
  const vip = allClientes.filter(c => c.estado === 'vip' || getComprasCliente(c.id).length >= 4).length;
  const rec = allClientes.filter(c => getComprasCliente(c.id).length >= 2).length;
  const totalGastado = allClientes.reduce((s,c) => s+getComprasCliente(c.id).reduce((ss,v)=>ss+(v.total||0),0), 0);
  const ticket = total > 0 ? totalGastado/total : 0;
  document.getElementById('cli-total').textContent = total;
  document.getElementById('cli-vip').textContent = vip;
  document.getElementById('cli-recurrentes').textContent = rec;
  document.getElementById('cli-ticket').textContent = fmt(ticket);

  const cumpleHoy = allClientes.filter(c => esCumpleHoy(c.nacimiento));
  const banner = document.getElementById('cli-cumple-banner');
  if (cumpleHoy.length) {
    banner.style.display = 'block';
    banner.textContent = '🎂 Cumpleaños hoy: ' + cumpleHoy.map(c => c.nombre).join(', ');
  } else banner.style.display = 'none';
}

function setCliFiltro(f, btn) {
  cliFiltro = f;
  document.querySelectorAll('#page-clientes .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtrarClientes();
}

function filtrarClientes() {
  const q = (document.getElementById('cli-search')?.value || '').toLowerCase();
  let lista = [...allClientes];
  if (q) lista = lista.filter(c => (c.nombre||'').toLowerCase().includes(q) || (c.tel||'').includes(q));
  if (cliFiltro === 'vip') lista = lista.filter(c => c.estado==='vip' || getComprasCliente(c.id).length>=4);
  else if (cliFiltro === 'recurrente') lista = lista.filter(c => getComprasCliente(c.id).length>=2);
  else if (cliFiltro === 'nuevo') lista = lista.filter(c => c.estado==='nuevo' && getComprasCliente(c.id).length<2);
  else if (cliFiltro === 'inactivo') lista = lista.filter(c => c.estado==='inactivo');
  renderClientes(lista);
}

function renderClientes(lista) {
  const grid = document.getElementById('cli-grid');
  if (!lista.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">Sin clientes en esta categoría</div>'; return; }
  grid.innerHTML = lista.map((c, i) => {
    const compras = getComprasCliente(c.id);
    const est = getCliEstado(c, compras);
    const totalGastado = compras.reduce((s,v)=>s+(v.total||0),0);
    const pagos = {};
    compras.forEach(v => { pagos[v.pago] = (pagos[v.pago]||0)+1; });
    const pagoFav = Object.entries(pagos).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
    const edad = getEdad(c.nacimiento);
    const cumple = esCumpleHoy(c.nacimiento);
    return `<div style="background:var(--surface);border:1px solid ${est.color === 'var(--purple)' ? 'var(--purple)' : 'var(--border)'};border-radius:var(--radius);padding:20px;cursor:pointer;transition:border-color .2s" onclick="verDetalleCliente('${c.id}')" onmouseover="this.style.borderColor='var(--green)'" onmouseout="this.style.borderColor='${est.color === 'var(--purple)' ? 'var(--purple)' : 'var(--border)'}'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="width:44px;height:44px;border-radius:50%;background:${CLI_AVATAR_COLORS[i%4]};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700">${getIniciales(c.nombre)}${cumple?' 🎂':''}</div>
        <span class="badge" style="background:${est.bg};color:${est.color}">${est.label}</span>
      </div>
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">${c.nombre||''}</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">${c.tel||''} · ${edad?edad+' años':''} · T${c.talle_zap||'?'} · ${c.talle_ropa||'?'} ropa</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px">${c.ciudad||''} · via ${c.origen||'—'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--surface2);border-radius:6px;padding:8px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Compras</div><div style="font-size:14px;font-weight:700;font-family:var(--mono);color:var(--blue)">${compras.length}</div></div>
        <div style="background:var(--surface2);border-radius:6px;padding:8px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Total gastado</div><div style="font-size:13px;font-weight:700;font-family:var(--mono);color:var(--green)">${fmt(totalGastado)}</div></div>
        <div style="background:var(--surface2);border-radius:6px;padding:8px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Pago fav.</div><div style="font-size:12px;font-weight:600">${pagoFav}</div></div>
        <div style="background:var(--surface2);border-radius:6px;padding:8px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Última compra</div><div style="font-size:12px;font-weight:600;font-family:var(--mono)">${compras.length ? compras[0].fecha||'—' : '—'}</div></div>
      </div>
      ${c.nota ? `<div style="margin-top:10px;padding:8px;background:var(--surface2);border-radius:6px;font-size:12px;color:var(--text3)">📝 ${c.nota}</div>` : ''}
    </div>`;
  }).join('');
}

function verDetalleCliente(id) {
  const c = allClientes.find(x => x.id === id);
  if (!c) return;
  const compras = getComprasCliente(id);
  const est = getCliEstado(c, compras);
  const totalGastado = compras.reduce((s,v)=>s+(v.total||0),0);
  const pagos = {};
  compras.forEach(v => { pagos[v.pago] = (pagos[v.pago]||0)+1; });
  const pagoFav = Object.entries(pagos).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
  const marcas = {};
  compras.forEach(v => { const m = (v.producto_nombre||'').split(' ')[0]; if(m) marcas[m]=(marcas[m]||0)+1; });
  const marcaFav = Object.entries(marcas).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
  const edad = getEdad(c.nacimiento);

  document.getElementById('cli-detalle-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--green-bg);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700">${getIniciales(c.nombre)}</div>
      <div><div style="font-size:18px;font-weight:700">${c.nombre||''}</div><span class="badge" style="background:${est.bg};color:${est.color}">${est.label}</span></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--surface2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Teléfono</div><div style="font-size:13px;font-weight:600">${c.tel||'—'}</div></div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Edad</div><div style="font-size:13px;font-weight:600">${edad?edad+' años':'—'}</div></div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Talle zapatillas</div><div style="font-size:13px;font-weight:600">T${c.talle_zap||'—'}</div></div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Talle ropa</div><div style="font-size:13px;font-weight:600">${c.talle_ropa||'—'}</div></div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Ciudad</div><div style="font-size:13px;font-weight:600">${c.ciudad||'—'}</div></div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Cómo llegó</div><div style="font-size:13px;font-weight:600">${c.origen||'—'}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--green-bg);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--green);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total gastado</div><div style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--green)">${fmt(totalGastado)}</div></div>
      <div style="background:var(--blue-bg);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--blue);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Pago favorito</div><div style="font-size:15px;font-weight:700;color:var(--blue)">${pagoFav}</div></div>
      <div style="background:#2e1065;border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--purple);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Marca favorita</div><div style="font-size:15px;font-weight:700;color:var(--purple)">${marcaFav}</div></div>
    </div>
    ${c.nota?`<div style="background:var(--surface2);border-radius:8px;padding:14px;margin-bottom:16px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">📝 Nota</div><div style="font-size:13px;color:var(--text2)">${c.nota}</div></div>`:''}
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-secondary btn-sm" onclick="editarCliente('${c.id}')">✏ Editar</button>
    </div>
    <div style="font-size:13px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Historial de compras (${compras.length})</div>
    ${compras.length ? compras.map(v=>`<div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <strong style="font-size:13px">${v.producto_nombre||''}</strong>
        <span style="font-family:var(--mono);color:var(--green);font-weight:700">${fmt(v.total)}</span>
      </div>
      <div style="font-size:11px;color:var(--text3)">${v.fecha||''} · <span class="badge badge-gray">${v.pago||''}</span></div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px;padding:12px">Sin compras registradas aún</div>'}`;

  document.getElementById('cli-detalle-panel').style.display = 'block';
  document.getElementById('cli-overlay').style.display = 'block';
}

function cerrarDetalleCliente() {
  document.getElementById('cli-detalle-panel').style.display = 'none';
  document.getElementById('cli-overlay').style.display = 'none';
}

function abrirModalCliente() {
  document.getElementById('modal-cliente-titulo').textContent = 'Nuevo cliente';
  document.getElementById('mc-id').value = '';
  ['mc-nombre','mc-tel','mc-ciudad','mc-nota'].forEach(id => document.getElementById(id).value = '');
  ['mc-nacimiento','mc-talle-zap'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mc-talle-ropa').value = '';
  document.getElementById('mc-origen').value = '';
  document.getElementById('mc-estado').value = 'nuevo';
  document.getElementById('modal-cliente').style.display = 'flex';
}

function editarCliente(id) {
  const c = allClientes.find(x => x.id === id);
  if (!c) return;
  cerrarDetalleCliente();
  document.getElementById('modal-cliente-titulo').textContent = 'Editar cliente';
  document.getElementById('mc-id').value = c.id;
  document.getElementById('mc-nombre').value = c.nombre||'';
  document.getElementById('mc-tel').value = c.tel||'';
  document.getElementById('mc-nacimiento').value = c.nacimiento||'';
  document.getElementById('mc-talle-zap').value = c.talle_zap||'';
  document.getElementById('mc-talle-ropa').value = c.talle_ropa||'';
  document.getElementById('mc-ciudad').value = c.ciudad||'';
  document.getElementById('mc-origen').value = c.origen||'';
  document.getElementById('mc-estado').value = c.estado||'nuevo';
  document.getElementById('mc-nota').value = c.nota||'';
  document.getElementById('modal-cliente').style.display = 'flex';
}

function cerrarModalCliente() { document.getElementById('modal-cliente').style.display = 'none'; }

async function guardarCliente() {
  const nombre = document.getElementById('mc-nombre').value.trim();
  if (!nombre) { toast('Ingresá el nombre', 'error'); return; }
  const id = document.getElementById('mc-id').value;
  const datos = {
    nombre,
    tel: document.getElementById('mc-tel').value.trim(),
    nacimiento: document.getElementById('mc-nacimiento').value || null,
    talle_zap: document.getElementById('mc-talle-zap').value,
    talle_ropa: document.getElementById('mc-talle-ropa').value,
    ciudad: document.getElementById('mc-ciudad').value.trim(),
    origen: document.getElementById('mc-origen').value,
    estado: document.getElementById('mc-estado').value,
    nota: document.getElementById('mc-nota').value.trim(),
    sucursal: currentSucursal
  };
  if (id) {
    await sb('clientes?id=eq.'+id, { method: 'PATCH', body: datos, prefer: 'return=minimal' });
    toast('Cliente actualizado ✓');
  } else {
    datos.id = crypto.randomUUID();
    datos.registrado_en = new Date().toISOString();
    await sb('clientes', { method: 'POST', body: datos, prefer: 'return=minimal' });
    toast('Cliente guardado ✓');
  }
  cerrarModalCliente();
  cargarClientes();
}

// BUSCAR CLIENTE EN VENTAS
