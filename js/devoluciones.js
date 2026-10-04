// devoluciones.js — Devoluciones

// DEVOLUCIONES
function buscarProductoDevol() {
  const q = document.getElementById('dev-prod-search').value;
  const dd = document.getElementById('autocomplete-dropdown');
  if (q.length < 2) { dd.style.display='none'; return; }
  const matches = allProductos.filter(p => matchTerminos(p, q)).slice(0, 8);
  if (!matches.length) { dd.style.display='none'; return; }
  const inp = document.getElementById('dev-prod-search');
  const rect = inp.getBoundingClientRect();
  dd.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = rect.width + 'px';
  dd.style.display = 'block';
  dd.innerHTML = matches.map(p => {
    const nombre = `${p.modelo||''} T${p.talle||''} ${p.color||''}`;
    return `<div onclick="seleccionarProductoDevol('${p.id}','${nombre.replace(/'/g,"&apos;")}')"
      style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <strong>${p.modelo}</strong> — T${p.talle} ${p.color||''}
    </div>`;
  }).join('');
}

function seleccionarProductoDevol(id, nombre) {
  document.getElementById('dev-prod-id').value = id;
  document.getElementById('dev-prod-nombre').value = nombre;
  document.getElementById('dev-prod-search').value = nombre;
  document.getElementById('autocomplete-dropdown').style.display = 'none';
}

async function cargarDevoluciones() {
  document.getElementById('dev-fecha').value = today();
  if (!allProductos.length) allProductos = await sb('productos?select=*') || [];
  const data = await sb('devoluciones?select=*&order=fecha.desc') || [];
  renderDevoluciones(data);
}

function renderDevoluciones(data) {
  const tbody = document.getElementById('dev-tbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="6" class="loading">Sin devoluciones registradas</td></tr>'; return; }
  tbody.innerHTML = data.map(d => `<tr>
    <td>${d.fecha||''}</td>
    <td><strong>${d.producto_nombre||''}</strong></td>
    <td>${d.motivo||''}</td>
    <td>${d.tipo||''}</td>
    <td class="mono green">${d.monto_reintegro > 0 ? fmt(d.monto_reintegro) : '—'}</td>
    <td><span class="badge badge-green">+${d.qty||1} al stock</span></td>
  </tr>`).join('');
}

async function registrarDevolucion() {
  const prodId = document.getElementById('dev-prod-id').value;
  if (!prodId) { toast('Seleccioná un producto', 'error'); return; }
  const qty = +document.getElementById('dev-qty').value || 1;
  const devol = {
    id: crypto.randomUUID(),
    producto_id: prodId,
    producto_nombre: document.getElementById('dev-prod-nombre').value,
    motivo: document.getElementById('dev-motivo').value,
    tipo: document.getElementById('dev-tipo').value,
    monto_reintegro: +document.getElementById('dev-monto').value || 0,
    qty,
    fecha: document.getElementById('dev-fecha').value,
    notas: document.getElementById('dev-notas').value,
    sucursal: currentSucursal,
    registrado_en: new Date().toISOString()
  };
  await sb('devoluciones', { method: 'POST', body: devol, prefer: 'return=minimal' });

  // Sumar stock
  const prod = allProductos.find(p => p.id === prodId);
  if (prod) {
    const nuevoStock = (prod.stock||0) + qty;
    await sb('productos?id=eq.'+prodId, { method: 'PATCH', body: { stock: nuevoStock }, prefer: 'return=minimal' });
    prod.stock = nuevoStock;
  }

  // Registrar movimiento
  await registrarMovimiento(prodId, devol.producto_nombre, 'devolucion', qty, devol.id, 'Devolución: ' + devol.motivo);

  toast('Devolución registrada ✓ — stock actualizado');
  document.getElementById('dev-prod-search').value = '';
  document.getElementById('dev-prod-id').value = '';
  document.getElementById('dev-prod-nombre').value = '';
  document.getElementById('dev-monto').value = '0';
  document.getElementById('dev-notas').value = '';
  cargarDevoluciones();
}


