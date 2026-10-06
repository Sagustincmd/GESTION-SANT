// caja.js — Caja diaria

// CAJA

async function cargarCaja() {
  cajaFechaActual = today();
  document.getElementById('caja-fecha-input').value = cajaFechaActual;
  const ventasEndpoint = esAdmin ? 'ventas?select=*&order=fecha.desc' : 'ventas?select=*&order=fecha.desc&sucursal=eq.' + currentSucursal;
  const productosEndpoint = esAdmin ? 'productos?select=*' : 'productos?select=*&sucursal=eq.' + currentSucursal;
  allVentas = await sb(ventasEndpoint) || [];
  allProductos = await sb(productosEndpoint) || [];
  renderCajaDia();
  renderCajaHistorial();
  renderCajaGrafico();
}

function setCajaFecha(tipo, btn) {
  document.querySelectorAll('#page-caja .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tipo === 'hoy') cajaFechaActual = today();
  else if (tipo === 'ayer') {
    const ayer = new Date(); ayer.setDate(ayer.getDate()-1);
    cajaFechaActual = ayer.toISOString().split('T')[0];
  }
  document.getElementById('caja-fecha-input').value = cajaFechaActual;
  renderCajaDia();
}

function setCajaFechaManual(fecha) {
  cajaFechaActual = fecha;
  document.querySelectorAll('#page-caja .filter-tab').forEach(b => b.classList.remove('active'));
  renderCajaDia();
}

function renderCajaDia() {
  const ventasDia = allVentas.filter(v => v.fecha === cajaFechaActual);
  const total = ventasDia.reduce((s,v) => s+(v.total||0), 0);
  const ganancia = ventasDia.reduce((s,v) => s+(v.total||0)-(v.costo||0)*(v.qty||1), 0);
  const ticket = ventasDia.length > 0 ? total / ventasDia.length : 0;

  document.getElementById('caja-total').textContent = fmt(total);
  document.getElementById('caja-cantidad').textContent = ventasDia.length;
  document.getElementById('caja-fecha-label').textContent = cajaFechaActual;
  const ganEl = document.getElementById('caja-ganancia');
  ganEl.textContent = fmt(ganancia);
  ganEl.className = 'card-value ' + (ganancia >= 0 ? 'green' : 'red');
  document.getElementById('caja-ticket').textContent = fmt(ticket);
  document.getElementById('caja-detalle-titulo').textContent = 'Ventas del ' + cajaFechaActual;

  // Desglose por pago
  const pagos = ['Efectivo','Transferencia','Débito','Crédito','Mercado Pago'];
  const pagoMap = {};
  pagos.forEach(p => pagoMap[p] = { count: 0, total: 0 });
  ventasDia.forEach(v => {
    const p = v.pago || 'Efectivo';
    if (!pagoMap[p]) pagoMap[p] = { count: 0, total: 0 };
    pagoMap[p].count++; pagoMap[p].total += v.total || 0;
  });
  document.getElementById('caja-pagos').innerHTML = Object.entries(pagoMap)
    .filter(([,d]) => d.count > 0)
    .sort((a,b) => b[1].total - a[1].total)
    .map(([pago, d]) => {
      const pct = total > 0 ? Math.round(d.total/total*100) : 0;
      return `<tr>
        <td><span class="badge badge-gray">${pago}</span></td>
        <td class="mono">${d.count}</td>
        <td class="mono green">${fmt(d.total)}</td>
        <td class="mono">${pct}%</td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" class="loading">Sin ventas este día</td></tr>';

  // Detalle ventas
  document.getElementById('caja-detalle').innerHTML = ventasDia.length
    ? ventasDia.map(v => {
        const gan = (v.total||0) - (v.costo||0)*(v.qty||1);
        return `<tr>
          <td><strong>${v.producto_nombre||''}</strong></td>
          <td class="mono">${getProdTalle(v.producto_id)}</td>
          <td>${getProdColor(v.producto_id)}</td>
          <td class="mono green">${fmt(v.precio)}</td>
          <td class="mono ${gan>=0?'green':'red'}">${fmt(gan)}</td>
          <td>${v.vendedor||''}</td>
          <td><span class="badge badge-gray">${v.pago||''}</span></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="loading">Sin ventas este día</td></tr>';
}

function renderCajaHistorial() {
  const mesFiltro = document.getElementById('caja-mes-filter').value;
  // Agrupar ventas por día
  const diasMap = {};
  allVentas.forEach(v => {
    if (!v.fecha) return;
    if (mesFiltro && !v.fecha.startsWith(mesFiltro)) return;
    const d = v.fecha;
    if (!diasMap[d]) diasMap[d] = { ventas: 0, total: 0, ganancia: 0, pagos: { Efectivo:0, Transferencia:0, Débito:0, Crédito:0, 'Mercado Pago':0 } };
    diasMap[d].ventas++;
    diasMap[d].total += v.total || 0;
    diasMap[d].ganancia += (v.total||0) - (v.costo||0)*(v.qty||1);
    const p = v.pago || 'Efectivo';
    if (diasMap[d].pagos[p] !== undefined) diasMap[d].pagos[p] += v.total||0;
  });

  // Populate month filter
  const meses = [...new Set(allVentas.map(v => v.fecha ? v.fecha.substring(0,7) : null).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('caja-mes-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los meses</option>' + meses.map(m => `<option value="${m}" ${m===current?'selected':''}>${m}</option>`).join('');

  const dias = Object.entries(diasMap).sort((a,b) => b[0].localeCompare(a[0]));
  document.getElementById('caja-historial').innerHTML = dias.length
    ? dias.map(([fecha, d]) => `<tr>
        <td><strong>${fecha}</strong></td>
        <td class="mono">${d.ventas}</td>
        <td class="mono green">${fmt(d.total)}</td>
        <td class="mono ${d.ganancia>=0?'green':'red'}">${fmt(d.ganancia)}</td>
        <td class="mono">${fmt(d.pagos['Efectivo'])}</td>
        <td class="mono">${fmt(d.pagos['Transferencia'])}</td>
        <td class="mono">${fmt(d.pagos['Débito'])}</td>
        <td class="mono">${fmt(d.pagos['Crédito'])}</td>
        <td class="mono">${fmt(d.pagos['Mercado Pago'])}</td>
      </tr>`).join('')
    : '<tr><td colspan="9" class="loading">Sin datos</td></tr>';

  // Totales
  const tTotal = dias.reduce((s,[,d])=>s+d.total,0);
  const tGan = dias.reduce((s,[,d])=>s+d.ganancia,0);
  const tVentas = dias.reduce((s,[,d])=>s+d.ventas,0);
  document.getElementById('caja-historial-totales').innerHTML = `
    <span>Días: <strong style="font-family:var(--mono)">${dias.length}</strong></span>
    <span>Ventas: <strong style="font-family:var(--mono)">${tVentas}</strong></span>
    <span>Total: <strong style="color:var(--green);font-family:var(--mono)">${fmt(tTotal)}</strong></span>
    <span>Ganancia: <strong style="color:${tGan>=0?'var(--green)':'var(--red)'};font-family:var(--mono)">${fmt(tGan)}</strong></span>`;
}

function renderCajaGrafico() {
  // Últimos 14 días
  const dias14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    dias14.push(d.toISOString().split('T')[0]);
  }
  const totalesDias = dias14.map(fecha => {
    const v = allVentas.filter(v => v.fecha === fecha);
    return v.reduce((s,v) => s+(v.total||0), 0);
  });
  const labels = dias14.map(d => d.substring(5));
  if (chartCaja) chartCaja.destroy();
  chartCaja = new Chart(document.getElementById('chart-caja'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: totalesDias,
        backgroundColor: totalesDias.map(v => v > 0 ? 'rgba(34,197,94,.7)' : 'rgba(82,82,91,.3)'),
        borderColor: totalesDias.map(v => v > 0 ? '#22c55e' : '#52525b'),
        borderWidth: 1, borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#71717a', callback: v => '$'+(v/1000).toFixed(0)+'k' }, grid: { color: '#2a2a2a' } }
      }
    }
  });
}
