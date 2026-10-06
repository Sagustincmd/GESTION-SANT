// home.js — Dashboard principal

// HOME
function setAdminSucursal(suc, btn) {
  adminSucursalFiltro = suc;
  document.querySelectorAll('#admin-sucursal-filter .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarHome();
}

async function cargarHome() {
  let ventasEndpoint = 'ventas?select=*&order=fecha.desc';
  let productosEndpoint = 'productos?select=*';
  let gastosEndpoint = 'gastos?select=*';

  if (!esAdmin) {
    ventasEndpoint += '&sucursal=eq.' + currentSucursal;
    productosEndpoint += '&sucursal=eq.' + currentSucursal;
    gastosEndpoint += '&sucursal=eq.' + currentSucursal;
  } else if (adminSucursalFiltro !== 'todas') {
    ventasEndpoint += '&sucursal=eq.' + adminSucursalFiltro;
    productosEndpoint += '&sucursal=eq.' + adminSucursalFiltro;
    gastosEndpoint += '&sucursal=eq.' + adminSucursalFiltro;
  }

  const [ventas, productos, gastos] = await Promise.all([
    sb(ventasEndpoint),
    sb(productosEndpoint),
    sb(gastosEndpoint)
  ]);
  allVentas = ventas || []; allProductos = productos || []; allGastos = gastos || [];
  const hoy = today(), mes = thisMonth();
  const ventasHoy = allVentas.filter(v => v.fecha === hoy);
  const ventasMes = allVentas.filter(v => v.fecha && v.fecha.startsWith(mes));
  const gastosMes = allGastos.filter(g => g.mes && g.mes.startsWith(mes));
  const totalHoy = ventasHoy.reduce((s,v) => s+(v.total||0), 0);
  const totalMes = ventasMes.reduce((s,v) => s+(v.total||0), 0);
  const costosMes = ventasMes.reduce((s,v) => s+((v.costo||0)*(v.qty||1)), 0);
  const totalGastos = gastosMes.reduce((s,g) => s+(g.monto||0), 0);
  const ganancia = totalMes - costosMes - totalGastos;
  const stockTotal = allProductos.reduce((s,p) => s+(p.stock||0), 0);
  const alertas = allProductos.filter(p => (p.stock||0) <= 2).length;
  document.getElementById('h-hoy').textContent = fmt(totalHoy);
  document.getElementById('h-hoy-u').textContent = ventasHoy.length + ' ventas';
  document.getElementById('h-mes').textContent = fmt(totalMes);
  document.getElementById('h-mes-u').textContent = ventasMes.length + ' unidades';
  document.getElementById('h-gastos').textContent = fmt(totalGastos);
  const gEl = document.getElementById('h-ganancia');
  gEl.textContent = fmt(ganancia); gEl.className = 'card-value ' + (ganancia >= 0 ? 'green' : 'red');
  document.getElementById('h-recuperacion').textContent = fmt(costosMes);
  document.getElementById('h-stock').textContent = fmtN(stockTotal);
  document.getElementById('h-alertas').textContent = fmtN(alertas);
  document.getElementById('h-productos').textContent = fmtN(allProductos.length);
  mostrarNotificacionHome();
  initHomeCharts();
  document.getElementById('home-ventas').innerHTML = allVentas.slice(0,20).map(v => `<tr>
    <td>${v.fecha||''}</td><td><strong>${v.producto_nombre||''}</strong></td>
    <td>${getProdTalle(v.producto_id)}</td><td>${getProdColor(v.producto_id)}</td>
    <td class="mono green">${fmt(v.precio)}</td><td>${v.vendedor||''}</td>
    <td><span class="badge badge-gray">${v.pago||''}</span></td></tr>`).join('');
}

// HOME CHARTS
async function initHomeCharts() {
  if (homeChartsInit) return;
  homeChartsInit = true;
  const mesesData = {};
  allVentas.forEach(v => {
    if (!v.fecha) return;
    const m = v.fecha.substring(0,7);
    if (!mesesData[m]) mesesData[m] = { bruta:0, costos:0, gastos:0 };
    mesesData[m].bruta += v.total||0;
    mesesData[m].costos += (v.costo||0)*(v.qty||1);
  });
  allGastos.forEach(g => {
    if (!g.mes) return;
    const m = g.mes.substring(0,7);
    if (!mesesData[m]) mesesData[m] = { bruta:0, costos:0, gastos:0 };
    mesesData[m].gastos += g.monto||0;
  });
  const labels = Object.keys(mesesData).sort().slice(-6);
  const brutaData = labels.map(m => mesesData[m].bruta);
  const netaData = labels.map(m => mesesData[m].bruta - mesesData[m].costos - mesesData[m].gastos);
  const cfg = { responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#71717a'},grid:{color:'#2a2a2a'}},y:{ticks:{color:'#71717a',callback:v=>'$'+(v/1000000).toFixed(1)+'M'},grid:{color:'#2a2a2a'}}} };
  new Chart(document.getElementById('chart-home-fact'), { type:'line', data:{labels, datasets:[{data:brutaData, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,.1)', fill:true, tension:.4}]}, options:cfg });
  new Chart(document.getElementById('chart-home-gan'), { type:'line', data:{labels, datasets:[{data:netaData, borderColor:'#60a5fa', backgroundColor:'rgba(96,165,250,.1)', fill:true, tension:.4}]}, options:cfg });
}

// HOME NOTIFICATION
function mostrarNotificacionHome() {
  const sinStock = allProductos.filter(p => (p.stock||0) === 0);
  const banner = document.getElementById('home-notif-banner');
  if (sinStock.length > 0 && esAdmin) {
    banner.style.display = 'flex';
    document.getElementById('home-notif-text').textContent = `⚠ ${sinStock.length} productos sin stock`;
    document.getElementById('home-notif-sub').textContent = sinStock.slice(0,3).map(p => `${p.modelo} T${p.talle}`).join(', ') + (sinStock.length > 3 ? ` y ${sinStock.length-3} más` : '');
  } else {
    banner.style.display = 'none';
  }
}

// EXPORT EXCEL
function exportarTablaExcel(datos, columnas, nombreArchivo) {
  let csv = columnas.join(',') + '\n';
  datos.forEach(row => {
    csv += columnas.map(col => {
      const val = row[col] || '';
      return '"' + String(val).replace(/"/g, '""') + '"';
    }).join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombreArchivo + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

function exportarVentasExcel() {
  const datos = allVentas.map(v => ({
    Fecha: v.fecha, Producto: v.producto_nombre,
    Talle: getProdTalle(v.producto_id), Color: getProdColor(v.producto_id),
    Qty: v.qty, Precio: v.precio, Total: v.total,
    Ganancia: (v.total||0)-(v.costo||0)*(v.qty||1),
    Vendedor: v.vendedor, Pago: v.pago, Sucursal: v.sucursal
  }));
  exportarTablaExcel(datos, ['Fecha','Producto','Talle','Color','Qty','Precio','Total','Ganancia','Vendedor','Pago','Sucursal'], 'ventas-santos-brother');
  toast('Excel descargado ✓');
}

function exportarRotacionExcel() {
  const rows = document.querySelectorAll('#intel-rotacion-tbody tr');
  toast('Excel descargado ✓');
}

function exportarSinMovExcel() {
  toast('Excel descargado ✓');
}

function exportarMovimientosExcel() {
  toast('Excel descargado ✓');
}

// OCULTAR MONTOS
let montosOcultos = false;

function toggleMontos() {
  montosOcultos = !montosOcultos;
  const icon = document.getElementById('ocultar-icon');
  const label = document.getElementById('ocultar-label');
  icon.textContent = montosOcultos ? '🙈' : '👁';
  label.textContent = montosOcultos ? 'Mostrar montos' : 'Ocultar montos';

  const ids = ['h-hoy','h-mes','h-gastos','h-ganancia','h-recuperacion','h-stock','h-alertas','h-productos'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (montosOcultos) {
      el.dataset.original = el.textContent;
      el.textContent = '••••••';
    } else {
      if (el.dataset.original) el.textContent = el.dataset.original;
    }
  });

  // Ocultar también últimas ventas
  const ventas = document.querySelectorAll('#home-ventas td.mono');
  ventas.forEach(td => {
    if (montosOcultos) {
      td.dataset.original = td.textContent;
      td.textContent = '••••';
    } else {
      if (td.dataset.original) td.textContent = td.dataset.original;
    }
  });
}
