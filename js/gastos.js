// gastos.js — Gastos fijos

// GASTOS
async function cargarGastos() {
  const endpoint = esAdmin ? 'gastos?select=*&order=mes.desc,creado_en.desc' : 'gastos?select=*&order=mes.desc,creado_en.desc&sucursal=eq.' + currentSucursal;
  const data = await sb(endpoint);
  allGastos = data || [];
  const meses = [...new Set(allGastos.map(g => g.mes).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('gastos-mes-filter');
  sel.innerHTML = '<option value="">Todos los meses</option>' + meses.map(m => `<option value="${m}">${m}</option>`).join('');
  document.getElementById('gasto-mes').value = thisMonth();
  filtrarGastos();
}

function filtrarGastos() {
  const mes = document.getElementById('gastos-mes-filter').value;
  const f = mes ? allGastos.filter(g => g.mes && g.mes.startsWith(mes)) : allGastos;
  document.getElementById('gastos-tbody').innerHTML = f.map(g => `<tr><td>${g.descripcion||''}</td><td>${g.mes||''}</td><td class="mono red">−${fmt(g.monto)}</td><td><button class="btn btn-danger btn-sm" onclick="eliminarGasto('${g.id}')">✕</button></td></tr>`).join('');
}

async function guardarGasto() {
  const desc = document.getElementById('gasto-desc').value.trim();
  if (!desc) { toast('Ingresá la descripción', 'error'); return; }
  const gasto = { id: crypto.randomUUID(), descripcion: desc, monto: +document.getElementById('gasto-monto').value||0, mes: document.getElementById('gasto-mes').value, sucursal: currentSucursal, creado_en: new Date().toISOString() };
  await sb('gastos', { method: 'POST', body: gasto, prefer: 'return=minimal' });
  toast('Gasto guardado ✓');
  document.getElementById('gasto-desc').value = '';
  document.getElementById('gasto-monto').value = '0';
  cargarGastos();
}

async function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await sb('gastos?id=eq.'+id, { method: 'DELETE' });
  toast('Gasto eliminado'); cargarGastos();
}
