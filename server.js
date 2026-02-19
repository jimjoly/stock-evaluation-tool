const express = require("express");
const path = require("path");

function createApp() {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, asOf: new Date().toISOString() });
  });

  app.use(express.static(path.join(__dirname, "public")));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  return app;
}

function startServer(
  port = process.env.PORT || 3000,
  host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1")
) {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const activePort = typeof address === "string" ? port : address.port;
      console.log(`Retirement Planner running at http://${host}:${activePort}`);
      resolve({ app, server, port: activePort });
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};
