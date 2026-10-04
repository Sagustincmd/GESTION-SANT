// init.js — Inicialización

window.addEventListener('load', async () => {
  const { data } = await sbClient.auth.getSession();
  if (data.session) mostrarApp(data.session.user);
});
