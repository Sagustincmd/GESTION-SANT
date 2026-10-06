// ventas.js — Registro y gestión de ventas

// VENTAS
async function cargarVentas() {
  document.getElementById('venta-fecha').value = today();
  if (!allClientes.length) allClientes = await sb('clientes?select=*') || [];
  if (!allProductos.length) allProductos = await sb('productos?select=*&order=modelo.asc') || [];
  const endpoint = esAdmin ? 'ventas?select=*&order=fecha.desc,registrado_en.desc' : 'ventas?select=*&order=fecha.desc,registrado_en.desc&sucursal=eq.' + currentSucursal;
  const data = await sb(endpoint);
  allVentas = data || [];
  // Populate month dropdown
  const meses = [...new Set(allVentas.map(v => v.fecha ? v.fecha.substring(0,7) : null).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('ventas-mes-select');
  sel.innerHTML = '<option value="">— Mes específico —</option>' + meses.map(m => `<option value="${m}">${m}</option>`).join('');
  aplicarFiltroVentas();
}

function setVentaFiltro(f, btn) {
  ventaFiltro = f;
  ventaMesEspecifico = '';
  document.getElementById('ventas-mes-select').value = '';
  document.querySelectorAll('#page-ventas .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); aplicarFiltroVentas();
}

function setVentaFiltroMes(mes) {
  ventaMesEspecifico = mes;
  if (mes) {
    ventaFiltro = '';
    document.querySelectorAll('#page-ventas .filter-tab').forEach(b => b.classList.remove('active'));
  }
  aplicarFiltroVentas();
}

function aplicarFiltroVentas() {
  const hoy = today(), mes = thisMonth(), anio = String(new Date().getFullYear());
  let f = [...allVentas];
  if (ventaMesEspecifico) f = f.filter(v => v.fecha && v.fecha.startsWith(ventaMesEspecifico));
  else if (ventaFiltro === 'hoy') f = f.filter(v => v.fecha === hoy);
  else if (ventaFiltro === 'semana') { const h = new Date(); h.setDate(h.getDate()-7); f = f.filter(v => v.fecha && new Date(v.fecha) >= h); }
  else if (ventaFiltro === 'mes') f = f.filter(v => v.fecha && v.fecha.startsWith(mes));
  else if (ventaFiltro === 'anio') f = f.filter(v => v.fecha && v.fecha.startsWith(anio));
  const q = (document.getElementById('ventas-search')?.value || '').toLowerCase();
  if (q) f = f.filter(v => (v.producto_nombre||'').toLowerCase().includes(q));
  const tbody = document.getElementById('ventas-tbody');
  if (!f.length) { tbody.innerHTML = '<tr><td colspan="11" class="loading">Sin ventas en este período</td></tr>'; document.getElementById('ventas-totales').innerHTML = ''; return; }
  tbody.innerHTML = f.map(v => {
    const gan = (v.total||0) - (v.costo||0)*(v.qty||1);
    return `<tr><td>${v.fecha||''}</td><td><strong>${v.producto_nombre||''}</strong></td>
    <td class="mono">${getProdTalle(v.producto_id)}</td><td>${getProdColor(v.producto_id)}</td>
    <td class="mono">${v.qty||1}</td><td class="mono">${fmt(v.precio)}</td><td class="mono">${fmt(v.total)}</td>
    <td class="mono ${gan>=0?'green':'red'}">${fmt(gan)}</td><td>${v.vendedor||''}</td>
    <td><span class="badge badge-gray">${v.pago||''}</span></td>
    <td><button class="btn btn-danger btn-sm" onclick="eliminarVenta('${v.id}')">✕</button></td></tr>`;
  }).join('');
  const tV = f.reduce((s,v)=>s+(v.total||0),0), tG = f.reduce((s,v)=>s+(v.total||0)-(v.costo||0)*(v.qty||1),0), tU = f.reduce((s,v)=>s+(v.qty||1),0);
  document.getElementById('ventas-totales').innerHTML = `<span>Total: <strong style="color:var(--green);font-family:var(--mono)">${fmt(tV)}</strong></span><span>Ganancia: <strong style="color:${tG>=0?'var(--green)':'var(--red)'};font-family:var(--mono)">${fmt(tG)}</strong></span><span>Unidades: <strong style="font-family:var(--mono)">${tU}</strong></span><span>Registros: <strong style="font-family:var(--mono)">${f.length}</strong></span>`;
}

function buscarProductoVenta() {
  const q = document.getElementById('venta-prod-search').value;
  const dd = document.getElementById('autocomplete-dropdown');
  if (q.length < 2) { dd.style.display='none'; return; }
  const matches = allProductos.filter(p => matchTerminos(p, q)).slice(0, 12);
  if (!matches.length) { dd.style.display='none'; return; }
  const inp = document.getElementById('venta-prod-search');
  const rect = inp.getBoundingClientRect();
  dd.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = rect.width + 'px';
  dd.style.display = 'block';
  dd.innerHTML = matches.map(p => {
    const safe = p.id;
    const nombre = (p.modelo||'') + ' T' + (p.talle||'') + ' ' + (p.color||'');
    return `<div onclick="seleccionarProducto('${safe}','${nombre.replace(/'/g,"&apos;")}','${p.costo||0}','${p.precio||0}')" style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''"><strong>${p.modelo}</strong> — T${p.talle} ${p.color||''} <span style="color:var(--text3);float:right">${fmt(p.precio)}</span></div>`;
  }).join('');
}

function seleccionarProducto(id, nombre, costo, precio) {
  document.getElementById('venta-prod-id').value = id;
  document.getElementById('venta-prod-nombre').value = nombre;
  document.getElementById('venta-prod-costo').value = costo;
  document.getElementById('venta-prod-search').value = nombre;
  document.getElementById('venta-precio').value = precio;
  document.getElementById('autocomplete-dropdown').style.display = 'none';
}
document.addEventListener('click', e => { if (!e.target.closest('#venta-prod-search') && !e.target.closest('#autocomplete-dropdown')) document.getElementById('autocomplete-dropdown').style.display='none'; });

async function registrarVenta() {
  const prodId = document.getElementById('venta-prod-id').value;
  if (!prodId) { toast('Seleccioná un producto', 'error'); return; }
  const qty = +document.getElementById('venta-qty').value||1, precio = +document.getElementById('venta-precio').value||0, costo = +document.getElementById('venta-prod-costo').value||0;
  const clienteId = document.getElementById('venta-cliente-id').value;
  const clienteNombre = document.getElementById('venta-cliente-nombre').value;
  const venta = { id: crypto.randomUUID(), producto_id: prodId, producto_nombre: document.getElementById('venta-prod-nombre').value, qty, precio, total: precio*qty, costo, fecha: document.getElementById('venta-fecha').value, vendedor: document.getElementById('venta-vendedor').value, pago: document.getElementById('venta-pago').value, nota: document.getElementById('venta-nota').value, sucursal: currentSucursal, cliente_id: clienteId||null, cliente_nombre: clienteNombre||null, registrado_en: new Date().toISOString() };
  await sb('ventas', { method: 'POST', body: venta, prefer: 'return=minimal' });
  const prod = allProductos.find(p => p.id === prodId);
  if (prod) { const ns = Math.max(0,(prod.stock||0)-qty); await sb('productos?id=eq.'+prodId, { method: 'PATCH', body: { stock: ns }, prefer: 'return=minimal' }); prod.stock = ns; }
  toast('Venta registrada ✓');
  await registrarMovimiento(prodId, venta.producto_nombre, 'venta', qty, venta.id, 'Venta registrada');
  document.getElementById('venta-prod-search').value = '';
  document.getElementById('venta-prod-id').value = '';
  document.getElementById('venta-prod-nombre').value = '';
  document.getElementById('venta-prod-costo').value = '';
  document.getElementById('venta-qty').value = '1';
  document.getElementById('venta-precio').value = '0';
  document.getElementById('venta-nota').value = '';
  document.getElementById('venta-cliente-search').value = '';
  document.getElementById('venta-cliente-id').value = '';
  document.getElementById('venta-cliente-nombre').value = '';
  cargarVentas();
}

async function eliminarVenta(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  await sb('ventas?id=eq.'+id, { method: 'DELETE' });
  toast('Venta eliminada'); cargarVentas();
}

// BUSCAR CLIENTE EN VENTAS
function buscarClienteVenta() {
  const q = document.getElementById('venta-cliente-search').value;
  const dd = document.getElementById('autocomplete-dropdown');
  if (q.length < 2) { dd.style.display='none'; document.getElementById('venta-cliente-nuevo').style.display='none'; return; }
  const matches = allClientes.filter(c => (c.nombre||'').toLowerCase().includes(q.toLowerCase()) || (c.tel||'').includes(q)).slice(0,8);
  const inp = document.getElementById('venta-cliente-search');
  const rect = inp.getBoundingClientRect();
  dd.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = rect.width + 'px';
  dd.style.display = 'block';
  document.getElementById('venta-cliente-nuevo').style.display = 'block';
  dd.innerHTML = matches.map(c => `<div onclick="seleccionarClienteVenta('${c.id}','${(c.nombre||'').replace(/'/g,"&apos;")}')"
    style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
    onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
    <strong>${c.nombre}</strong> <span style="color:var(--text3);font-size:12px">${c.tel||''} · T${c.talle_zap||'?'}</span>
  </div>`).join('') || '<div style="padding:10px 14px;color:var(--text3);font-size:13px">Sin resultados</div>';
}

function seleccionarClienteVenta(id, nombre) {
  document.getElementById('venta-cliente-id').value = id;
  document.getElementById('venta-cliente-nombre').value = nombre;
  document.getElementById('venta-cliente-search').value = nombre;
  document.getElementById('autocomplete-dropdown').style.display = 'none';
  document.getElementById('venta-cliente-nuevo').style.display = 'none';
}

async function crearClienteRapido() {
  const nombre = document.getElementById('venta-cliente-search').value.trim();
  if (!nombre) return;
  const nuevo = { id: crypto.randomUUID(), nombre, estado: 'nuevo', sucursal: currentSucursal, registrado_en: new Date().toISOString() };
  await sb('clientes', { method: 'POST', body: nuevo, prefer: 'return=minimal' });
  allClientes.unshift(nuevo);
  seleccionarClienteVenta(nuevo.id, nombre);
  toast('Cliente creado ✓');
}
