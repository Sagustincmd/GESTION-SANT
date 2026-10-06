// bandeja.js — Bandeja del agente de Instagram
// Revisar, editar y aprobar los borradores del agente + avisos push en la compu.
// Lee con la sesión del usuario (RLS): solo los usuarios habilitados ven las conversaciones.

const BJ_FUNC_URL = SUPABASE_URL + '/functions/v1/ig-agente';
let bjMensajes = [], bjClientes = {}, bjFiltro = 'pendientes', bjSel = null, bjEditando = false;
let bjTimer = null, bjContadorTimer = null, bjModo = '';

const bjEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function bjHora(ts) {
  const d = new Date(ts), hoy = new Date();
  const h = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === hoy.toDateString() ? h : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + h;
}
function bjNombre(id) {
  const c = bjClientes[id];
  if (!c) return 'Cliente';
  if (c.nombre && /[a-záéíóúñ]/i.test(c.nombre)) return c.nombre;
  return c.username ? '@' + c.username : 'Cliente';
}

async function bjLlamar(body) {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) return { ok: false, detalle: 'Sesión vencida. Volvé a iniciar sesión.' };
  try {
    const r = await fetch(BJ_FUNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token, 'apikey': SUPABASE_KEY },
      body: JSON.stringify(body)
    });
    return await r.json();
  } catch (_) {
    return { ok: false, detalle: 'No hay conexión. Probá de nuevo.' };
  }
}

/* ---------- Arranque global (contador del menú, avisos, abrir desde notificación) ---------- */
function iniciarBandejaGlobal() {
  bjActualizarContador();
  clearInterval(bjContadorTimer);
  bjContadorTimer = setInterval(bjActualizarContador, 30000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.tipo === 'abrir-bandeja') bjAbrirDesdeAviso(e.data.cliente);
    });
  }
  const params = new URLSearchParams(location.search);
  if (params.has('bandeja')) {
    bjAbrirDesdeAviso(params.get('bandeja'));
    history.replaceState(null, '', location.pathname);
  }
}

function bjAbrirDesdeAviso(cliente) {
  bjSel = cliente && cliente !== 'prueba' ? cliente : null;
  bjEditando = false;
  goTo('bandeja', document.getElementById('nav-bandeja'));
}

async function bjActualizarContador() {
  const { data, error } = await sbClient.from('ig_mensajes')
    .select('ig_user_id').eq('estado', 'borrador').limit(500);
  const el = document.getElementById('bandeja-count');
  if (!el) return;
  if (error) { el.style.display = 'none'; return; }
  const n = new Set((data || []).map(x => x.ig_user_id)).size;
  el.textContent = n;
  el.style.display = n ? 'inline-block' : 'none';
}

/* ---------- Página ---------- */
async function cargarBandeja() {
  const root = document.getElementById('bj-root');
  if (!document.getElementById('bj-lista')) {
    root.innerHTML = `
      <div class="bj-barra">
        <div class="bj-filtros">
          <button data-f="pendientes" class="on">Para revisar <span id="bj-n-pendientes"></span></button>
          <button data-f="cerrar">Para cerrar <span id="bj-n-cerrar"></span></button>
          <button data-f="todas">Todas</button>
        </div>
        <div class="bj-barra-der">
          <span class="badge" id="bj-modo">…</span>
          <span id="bj-avisos"></span>
        </div>
      </div>
      <div class="bj-layout">
        <div class="bj-lista" id="bj-lista"></div>
        <div class="bj-chat" id="bj-chat"><div class="bj-vacio">Elegí una conversación para ver el borrador del agente.</div></div>
      </div>
      <div class="bj-pie" id="bj-actualizado"></div>`;
    root.querySelectorAll('.bj-filtros button').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('.bj-filtros button').forEach(x => x.classList.toggle('on', x === b));
      bjFiltro = b.dataset.f;
      bjPintarLista();
    }));
  }
  if (!bjModo) {
    const m = await bjLlamar({ accion: 'modo' });
    if (m && m.ok === false) { document.getElementById('bj-chat').innerHTML = `<div class="bj-vacio">${bjEsc(m.detalle)}</div>`; }
    bjModo = (m && m.modo) || '';
  }
  const modoEl = document.getElementById('bj-modo');
  modoEl.textContent = bjModo === 'auto' ? 'Agente en automático' : 'Agente en modo borrador';
  modoEl.className = 'badge ' + (bjModo === 'auto' ? 'badge-green' : 'badge-yellow');
  bjPintarAvisos();
  await bjCargarDatos();
  clearInterval(bjTimer);
  bjTimer = setInterval(() => {
    const visible = document.getElementById('page-bandeja').classList.contains('active');
    if (visible && !bjEditando) bjCargarDatos();
  }, 20000);
}

async function bjCargarDatos() {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const [m, c] = await Promise.all([
    sbClient.from('ig_mensajes').select('*').gte('creado_en', desde).order('id', { ascending: true }).limit(3000),
    sbClient.from('ig_clientes').select('*')
  ]);
  if (m.error) {
    document.getElementById('bj-lista').innerHTML = `<div class="bj-vacio">No se pudieron leer los mensajes: ${bjEsc(m.error.message)}</div>`;
    return;
  }
  bjMensajes = m.data || [];
  bjClientes = Object.fromEntries((c.data || []).map(x => [x.ig_user_id, x]));
  document.getElementById('bj-actualizado').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' · se actualiza solo cada 20 segundos';
  bjPintarLista();
  if (bjSel) bjPintarChat(bjSel);
  bjActualizarContador();
}

function bjConversaciones() {
  const g = {};
  for (const m of bjMensajes) (g[m.ig_user_id] ||= []).push(m);
  return Object.entries(g).map(([id, ms]) => {
    const ultimo = ms[ms.length - 1];
    const borrador = ms.find(x => x.estado === 'borrador');
    const iErr = ms.map(x => x.estado).lastIndexOf('error');
    const error = iErr >= 0 && !ms.slice(iErr + 1).some(x => x.rol === 'agente' && x.estado === 'enviado');
    const cerrar = ms.some(x => x.derivar && !x.atendido && (x.estado === 'enviado' || x.estado === 'borrador'));
    const motivo = [...ms].reverse().find(x => x.derivar && !x.atendido && x.motivo)?.motivo;
    return { id, ms, ultimo, borrador, error, cerrar, motivo, sinRespuesta: ultimo.rol === 'cliente' };
  }).sort((a, b) => b.ultimo.id - a.ultimo.id);
}
const bjPendiente = c => c.borrador || c.error || c.sinRespuesta;

function bjPintarLista() {
  const cs = bjConversaciones();
  const np = cs.filter(bjPendiente).length, nc = cs.filter(c => c.cerrar).length;
  document.getElementById('bj-n-pendientes').textContent = np ? `(${np})` : '';
  document.getElementById('bj-n-cerrar').textContent = nc ? `(${nc})` : '';
  const vis = cs.filter(c => bjFiltro === 'todas' ? true : bjFiltro === 'cerrar' ? c.cerrar : bjPendiente(c));
  const lista = document.getElementById('bj-lista');
  if (!vis.length) {
    lista.innerHTML = `<div class="bj-vacio">${bjFiltro === 'cerrar' ? 'No hay ventas esperando que las cierren.' : bjFiltro === 'pendientes' ? 'Todo al día. Cuando entre un mensaje, el borrador aparece acá.' : 'Todavía no hay conversaciones.'}</div>`;
    return;
  }
  lista.innerHTML = vis.map(c => {
    const prev = c.ultimo.texto || (c.ultimo.adjuntos ? 'Envió una imagen' : (c.ultimo.estado === 'error' ? 'Error al responder' : ''));
    const chips = [
      c.borrador ? '<span class="bj-chip borrador">Borrador listo</span>' : '',
      !c.borrador && c.sinRespuesta ? '<span class="badge badge-gray">El agente está escribiendo</span>' : '',
      c.error ? '<span class="badge badge-red">Error</span>' : '',
      c.cerrar ? '<span class="badge badge-yellow">Para cerrar</span>' : ''
    ].join('');
    return `<button class="bj-conv ${bjSel === c.id ? 'sel' : ''}" data-id="${bjEsc(c.id)}">
      <div class="bj-conv-top"><span class="bj-conv-nombre">${bjEsc(bjNombre(c.id))}</span><span class="bj-conv-hora">${bjHora(c.ultimo.creado_en)}</span></div>
      <div class="bj-conv-prev">${c.ultimo.rol === 'agente' ? 'Vos: ' : ''}${bjEsc(prev)}</div>
      ${chips ? `<div class="bj-chips">${chips}</div>` : ''}
    </button>`;
  }).join('');
  lista.querySelectorAll('.bj-conv').forEach(b => b.addEventListener('click', () => {
    bjSel = b.dataset.id; bjEditando = false; bjPintarLista(); bjPintarChat(bjSel);
  }));
}

function bjBurbuja(m) {
  const t = bjEsc(m.texto || '');
  if (m.rol === 'cliente') {
    const imgs = (m.adjuntos || []).filter(a => a && a.payload && a.payload.url)
      .map(a => `<img src="${bjEsc(a.payload.url)}" alt="Imagen enviada por el cliente" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('em'),{textContent:'[imagen ya no disponible]'}))">`).join('');
    const historia = (m.adjuntos || []).some(a => a.type === 'story_reply') ? '<em>Respondió a una historia</em><br>' : '';
    return `<div class="bj-b bj-b-cliente">${historia}${imgs}${t}<span class="bj-meta">${bjHora(m.creado_en)}</span></div>`;
  }
  if (m.estado === 'enviado') {
    const manual = m.motivo === 'respuesta manual';
    const quien = manual ? 'Escrito a mano' : (m.motivo === 'borrador editado' ? 'Agente, editado' : 'Agente');
    return `<div class="bj-b ${manual ? 'bj-b-manual' : 'bj-b-agente'}">${t}<span class="bj-meta">${quien} · ${bjHora(m.creado_en)}</span></div>`;
  }
  if (m.estado === 'error') return `<div class="bj-b bj-b-error">El agente no pudo responder este mensaje.<span class="bj-meta">${bjHora(m.creado_en)}</span></div>`;
  if (m.estado === 'descartado') return `<div class="bj-b bj-b-descartado">${t}<span class="bj-meta">Borrador descartado</span></div>`;
  return '';
}

function bjPintarChat(id) {
  if (bjEditando) return;
  const c = bjConversaciones().find(x => x.id === id);
  const chat = document.getElementById('bj-chat');
  if (!c) { chat.innerHTML = '<div class="bj-vacio">Elegí una conversación.</div>'; return; }
  const cli = bjClientes[id] || {};
  const b = c.borrador;
  chat.innerHTML = `
    <div class="bj-chat-top">
      <div><strong>${bjEsc(bjNombre(id))}</strong><span>${cli.username ? '@' + bjEsc(cli.username) : 'Sin usuario'}</span></div>
      ${cli.username ? `<a class="btn btn-secondary btn-sm" href="https://instagram.com/${encodeURIComponent(cli.username)}" target="_blank" rel="noopener">Ver perfil</a>` : ''}
    </div>
    ${c.cerrar ? `<div class="bj-aviso-cerrar"><span>Para cerrar: ${bjEsc(c.motivo || 'venta derivada al equipo')}</span><button class="btn btn-secondary btn-sm" id="bj-atendido">Marcar como atendido</button></div>` : ''}
    <div class="bj-hilo" id="bj-hilo">
      ${c.ms.filter(m => m.estado !== 'borrador').map(bjBurbuja).join('')}
      ${b ? `<div class="bj-borrador">
        <div class="bj-borrador-tit"><span>Borrador del agente, sin enviar</span>${b.derivar ? `<span class="bj-motivo">${bjEsc(b.motivo || 'Derivado al equipo')}</span>` : ''}</div>
        <textarea id="bj-txt-borrador" aria-label="Texto del borrador">${bjEsc(b.texto || '')}</textarea>
        <div class="bj-borrador-acc">
          <button class="btn btn-secondary btn-sm" id="bj-descartar">Descartar</button>
          <button class="btn btn-primary btn-sm" id="bj-enviar">Enviar</button>
        </div>
        <div class="bj-err" id="bj-err-borrador"></div>
      </div>` : ''}
    </div>
    <div class="bj-composer">
      <textarea id="bj-txt-manual" rows="1" placeholder="Escribí tu propia respuesta…" aria-label="Respuesta manual"></textarea>
      <button class="btn btn-primary" id="bj-enviar-manual">Enviar</button>
    </div>
    <div class="bj-err bj-err-composer" id="bj-err-manual"></div>`;
  const hilo = document.getElementById('bj-hilo');
  hilo.scrollTop = hilo.scrollHeight;

  const tm = document.getElementById('bj-txt-manual');
  const tb = document.getElementById('bj-txt-borrador');
  const marcarEdicion = () => { bjEditando = !!tm.value.trim() || !!(b && tb && tb.value !== b.texto); };
  tm.addEventListener('input', () => { document.getElementById('bj-err-manual').textContent = ''; marcarEdicion(); });

  document.getElementById('bj-enviar-manual').onclick = async () => {
    const texto = tm.value.trim();
    if (!texto) { document.getElementById('bj-err-manual').textContent = 'Escribí un mensaje primero.'; return; }
    const btn = document.getElementById('bj-enviar-manual'); btn.disabled = true;
    const r = await bjLlamar({ accion: 'responder', ig_user_id: id, texto });
    btn.disabled = false;
    if (!r || !r.ok) { document.getElementById('bj-err-manual').textContent = (r && r.detalle) || 'No se pudo enviar.'; return; }
    bjEditando = false; toast('Mensaje enviado'); bjCargarDatos();
  };

  if (b) {
    tb.addEventListener('input', () => { document.getElementById('bj-err-borrador').textContent = ''; marcarEdicion(); });
    document.getElementById('bj-enviar').onclick = async () => {
      const texto = tb.value.trim();
      if (!texto) { document.getElementById('bj-err-borrador').textContent = 'El mensaje está vacío.'; return; }
      const btn = document.getElementById('bj-enviar'); btn.disabled = true;
      const r = await bjLlamar({ accion: 'enviar_borrador', id: b.id, texto });
      btn.disabled = false;
      if (!r || !r.ok) { document.getElementById('bj-err-borrador').textContent = (r && r.detalle) || 'No se pudo enviar.'; return; }
      bjEditando = false; toast('Mensaje enviado'); bjCargarDatos();
    };
    document.getElementById('bj-descartar').onclick = async () => {
      const r = await bjLlamar({ accion: 'descartar', id: b.id });
      if (!r || !r.ok) { document.getElementById('bj-err-borrador').textContent = (r && r.detalle) || 'No se pudo descartar.'; return; }
      bjEditando = false; toast('Borrador descartado'); bjCargarDatos();
    };
  }
  if (c.cerrar) {
    document.getElementById('bj-atendido').onclick = async () => {
      const r = await bjLlamar({ accion: 'atendido', ig_user_id: id });
      if (!r || !r.ok) { toast((r && r.detalle) || 'No se pudo marcar', 'error'); return; }
      toast('Marcado como atendido'); bjCargarDatos();
    };
  }
}

/* ---------- Avisos push ---------- */
function bjB64aBytes(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
}

async function bjSuscripcionActual() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

async function bjPintarAvisos() {
  const el = document.getElementById('bj-avisos');
  if (!el) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    el.innerHTML = '<span class="bj-nota">Este navegador no admite avisos. Usá Chrome o Edge.</span>';
    return;
  }
  if (Notification.permission === 'denied') {
    el.innerHTML = '<span class="bj-nota">Los avisos están bloqueados para este sitio. Habilitalos desde el candado de la barra de direcciones.</span>';
    return;
  }
  const sub = await bjSuscripcionActual();
  if (sub) {
    el.innerHTML = '<button class="btn btn-secondary btn-sm" id="bj-probar">Probar aviso</button> <button class="btn btn-secondary btn-sm" id="bj-desactivar">Desactivar avisos</button>';
    document.getElementById('bj-probar').onclick = async () => {
      const r = await bjLlamar({ accion: 'push_prueba' });
      toast((r && r.detalle) || 'No se pudo enviar', r && r.ok ? 'success' : 'error');
    };
    document.getElementById('bj-desactivar').onclick = async () => {
      await bjLlamar({ accion: 'push_desuscribir', endpoint: sub.endpoint });
      await sub.unsubscribe();
      toast('Avisos desactivados en esta compu');
      bjPintarAvisos();
    };
  } else {
    el.innerHTML = '<button class="btn btn-primary btn-sm" id="bj-activar">Activar avisos en esta compu</button>';
    document.getElementById('bj-activar').onclick = bjActivarAvisos;
  }
}

async function bjActivarAvisos() {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') { toast('Sin permiso no se pueden mostrar avisos', 'error'); bjPintarAvisos(); return; }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const clave = await bjLlamar({ accion: 'push_clave' });
    if (!clave || !clave.publicKey) throw new Error((clave && clave.detalle) || 'Sin clave');
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bjB64aBytes(clave.publicKey) });
    const r = await bjLlamar({ accion: 'push_suscribir', suscripcion: sub.toJSON() });
    if (!r || !r.ok) throw new Error((r && r.detalle) || 'No se pudo guardar');
    toast('Avisos activados en esta compu');
  } catch (e) {
    toast('No se pudieron activar los avisos: ' + e.message, 'error');
  }
  bjPintarAvisos();
}
