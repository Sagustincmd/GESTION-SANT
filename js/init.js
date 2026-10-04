// init.js — Inicialización de la aplicación

window.addEventListener('load', async () => {
  const { data } = await sbClient.auth.getSession();
  if (data.session) mostrarApp(data.session.user);
});
