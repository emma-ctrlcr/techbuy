require('dotenv').config();
process.env.TZ = 'America/Managua';

const http = require('http');
const app = require('./src/index');
const { setupSocketIO } = require('./src/socket');

const server = http.createServer(app);
setupSocketIO(server);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`\nTechBuy Unificado corriendo en http://localhost:${PORT}`);
  console.log(`Store:  http://localhost:${PORT}/store/pages/1.html`);
  console.log(`Admin:  http://localhost:${PORT}/admin/login.html`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
