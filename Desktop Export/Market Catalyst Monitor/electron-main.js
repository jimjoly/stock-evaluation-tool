const { app, BrowserWindow } = require("electron");
const { startServer } = require("./server");

let mainWindow;
let backend;

async function stopBackend() {
  if (!backend?.server) return;
  const server = backend.server;
  backend = null;
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function createWindow() {
  backend = await startServer(0);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#061d2b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await mainWindow.loadURL(`http://localhost:${backend.port}`);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  await stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await stopBackend();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});
