// Entry point for Vercel serverless — imports from pre-built dist/
const { getExpressServer } = require('../dist/serverless');

let bootError = null;
let appReady = false;
let server = null;

// Try to boot on first request, cache result
async function getApp() {
  if (appReady) return server;
  if (bootError) throw bootError;
  try {
    server = await getExpressServer();
    appReady = true;
    return server;
  } catch (err) {
    bootError = err;
    throw err;
  }
}

module.exports = async (req, res) => {
  // Debug endpoint — reveals boot errors without crashing silently
  if (req.url === '/debug-boot') {
    res.setHeader('Content-Type', 'application/json');
    try {
      await getApp();
      res.end(JSON.stringify({ ok: true, env: { hasDb: !!process.env.DATABASE_URL, node: process.version } }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message, stack: err.stack }));
    }
    return;
  }

  try {
    const app = await getApp();
    app(req, res);
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
};
