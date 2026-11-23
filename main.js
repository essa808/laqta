const { app, BrowserWindow, ipcMain, desktopCapturer, session, screen, globalShortcut,
  clipboard, nativeImage, shell, dialog, Tray, Menu, powerSaveBlocker, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// a second launch (e.g. from the right-click menu) is forwarded to the running window
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaults = () => ({
  lang: 'ar', theme: 'dark', outDir: path.join(app.getPath('videos'), 'Laqta'),
  fps: 30, quality: 'high', countdown: 3, hideOnRecord: true, autoCopy: true, contextMenu: false,
  shotDelay: 0, openEditor: true, closeToTray: true, startWithWindows: false,
  hotkeys: { full: 'CommandOrControl+Alt+1', region: 'CommandOrControl+Alt+2', rec: 'CommandOrControl+Alt+R', pause: 'CommandOrControl+Alt+P' },
});
let settings;
function loadSettings() {
  const d = defaults();
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    settings = { ...d, ...saved, hotkeys: { ...d.hotkeys, ...saved.hotkeys } };
  } catch { settings = d; }
}
const saveSettings = () => fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
const outDir = () => { fs.mkdirSync(settings.outDir, { recursive: true }); return settings.outDir; };
// local time (UTC would confuse the file names vs the history list) + ms so captures never collide
const stamp = () => {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`;
};
const L = () => { const d = require('./i18n.js').dict; return d[settings.lang] || d.ar; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const notify = (title, body) => { try { if (Notification.isSupported()) new Notification({ title, body }).show(); } catch {} };

let win, tray = null, quitting = false, trayHinted = false;
let pendingCapture = { id: null, loopback: false };

function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 760, minWidth: 880, minHeight: 600,
    backgroundColor: settings.theme === 'dark' ? '#111318' : '#f5f6f8',
    autoHideMenuBar: true, title: 'Laqta',
    // backgroundThrottling:false keeps the recording canvas at full fps while minimized
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  });
  win.loadFile('index.html');
  // closing hides to the tray so the global hotkeys keep working
  win.on('close', e => {
    if (quitting || !settings.closeToTray) return;
    e.preventDefault();
    win.hide();
    if (!trayHinted) { trayHinted = true; notify('Laqta', L().trayHint); }
  });
  if (!app.isPackaged) {
    win.webContents.on('console-message', (e, ...a) => {
      const d = e.message !== undefined ? e : { level: a[0], message: a[1] };
      if (d.level === 'error' || d.level >= 2) console.log('[renderer]', d.message);
    });
  }
}

function showWin() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  win.restore(); win.show(); win.focus();
}

// ---------- tray ----------
function buildTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(path.join(__dirname, 'win11menu', 'logo.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Laqta');
  tray.on('click', showWin);
  refreshTray();
}
function refreshTray() {
  if (!tray) return;
  const s = L();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: s.openApp, click: showWin },
    { type: 'separator' },
    { label: s.fullScreen, click: () => screenshot('full', { show: settings.openEditor }) },
    { label: s.region, click: () => screenshot('region', { show: settings.openEditor }) },
    { label: s.navRecord, click: () => { showWin(); win.webContents.send('action', 'screen'); } },
    { type: 'separator' },
    { label: s.navSettings, click: () => { showWin(); win.webContents.send('show-page', 'settings'); } },
    { type: 'separator' },
    { label: s.quit, click: () => app.quit() },
  ]));
}

// ---------- capture helpers ----------
async function grabDisplay(withImage = true) {
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const thumbnailSize = withImage
    ? { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) }
    : { width: 0, height: 0 };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  const src = sources.find(s => s.display_id === String(d.id)) || sources[0];
  return { display: d, image: src.thumbnail, sourceId: src.id };
}

async function hideWin() {
  if (win.isVisible() && !win.isMinimized()) {
    win.hide();
    await new Promise(r => setTimeout(r, 250)); // let the compositor drop our window
  }
}

let regionResolve = null, regionInit = null, regionWin = null;
function selectRegion(display, imageDataUrl) {
  return new Promise(resolve => {
    regionResolve = resolve;
    regionInit = { image: imageDataUrl, lang: settings.lang };
    const b = display.bounds;
    // screenshot mode shows a frozen image, so it needs no transparency (transparent windows are flaky on Windows)
    const ov = regionWin = new BrowserWindow({
      x: b.x, y: b.y, width: b.width, height: b.height, show: false, frame: false,
      transparent: !imageDataUrl, backgroundColor: imageDataUrl ? '#000000' : '#00000000',
      resizable: false, movable: false, skipTaskbar: true, hasShadow: false, enableLargerThanScreen: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js') },
    });
    ov.setAlwaysOnTop(true, 'screen-saver');
    ov.loadFile('overlay.html');
    ov.once('ready-to-show', () => {
      ov.setBounds(b); // the constructor clamps to the work area; this also covers the taskbar
      ov.show(); ov.focus();
    });
    ov.on('blur', () => { if (!ov.isDestroyed()) ov.focus(); }); // keep Esc working
    ov.on('closed', () => {
      regionWin = null;
      if (regionResolve) { regionResolve(null); regionResolve = null; }
    });
  });
}
ipcMain.handle('region-init', () => regionInit);
ipcMain.on('region-done', (e, rect) => {
  const r = regionResolve; regionResolve = null;
  BrowserWindow.fromWebContents(e.sender)?.close();
  r && r(rect);
});

function saveShot(img, show = true) {
  const file = path.join(outDir(), `screenshot-${stamp()}.png`);
  fs.writeFileSync(file, img.toPNG());
  if (settings.autoCopy) clipboard.writeImage(img);
  if (show) {
    showWin();
    win.webContents.send('screenshot-taken', { file, dataUrl: img.toDataURL() });
  } else {
    notify('Laqta', `${L().saved}${settings.autoCopy ? ' + ' + L().copied : ''}: ${path.basename(file)}`);
  }
}

let capturing = false;
async function screenshot(mode, opts = {}) {
  if (capturing) { regionWin?.focus(); return; } // a second hotkey press must not stack invisible overlays
  capturing = true;
  const show = opts.show !== false, wasVisible = win.isVisible();
  try {
    if (settings.shotDelay > 0) await sleep(settings.shotDelay * 1000); // time to open a menu before the shot
    await hideWin();
    const { display, image } = await grabDisplay(true);
    if (image.isEmpty()) throw new Error('screen capture returned an empty image');
    if (mode !== 'region') return saveShot(image, show);
    const rect = await selectRegion(display, image.toDataURL());
    if (!rect) { if (show) showWin(); return; }
    const { width: iw, height: ih } = image.getSize();
    const sx = iw / display.size.width, sy = ih / display.size.height; // real pixel ratio of the thumbnail
    const x = Math.min(iw - 1, Math.max(0, Math.round(rect.x * sx))), y = Math.min(ih - 1, Math.max(0, Math.round(rect.y * sy)));
    saveShot(image.crop({
      x, y, width: Math.max(1, Math.min(iw - x, Math.round(rect.width * sx))), height: Math.max(1, Math.min(ih - y, Math.round(rect.height * sy))),
    }), show);
  } catch (err) {
    if (show) { showWin(); win.webContents.send('error', String(err && err.message || err)); }
    else notify('Laqta', `${L().err}${err && err.message || err}`);
  } finally {
    capturing = false;
    // a silent capture must not leave a window that was open before the shot hidden
    if (wasVisible && !show) showWin();
  }
}

// ---------- IPC ----------
ipcMain.handle('get-settings', () => settings);
ipcMain.handle('set-settings', (e, patch) => {
  Object.assign(settings, patch); saveSettings();
  if ('lang' in patch) refreshTray();
  if ('startWithWindows' in patch) applyStartup();
  // menu labels follow the language, so rewrite them when it changes
  if ('contextMenu' in patch || ('lang' in patch && settings.contextMenu)) {
    try { applyContextMenu(settings.contextMenu); }
    catch { settings.contextMenu = false; saveSettings(); try { applyContextMenu(false); } catch {} }
  }
  return settings;
});

// ---------- run at login (a second launch just focuses the open window) ----------
function applyStartup() {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!settings.startWithWindows,
      path: process.execPath,
      args: app.isPackaged ? [] : [app.getAppPath()],
    });
  } catch {}
  return settings.startWithWindows;
}
ipcMain.handle('startup-set', (e, on) => { settings.startWithWindows = !!on; saveSettings(); return applyStartup(); });

// ---------- video studio ----------
ipcMain.handle('choose-video', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Video', extensions: ['mp4', 'webm', 'mkv', 'mov', 'm4v'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { path: p, url: pathToFileURL(p).href, name: path.basename(p) };
});
ipcMain.handle('file-url', (e, p) => pathToFileURL(p).href);

// ---------- Windows right-click menu (desktop + inside folders), per-user, removable ----------
const { execFileSync } = require('child_process');
const MENU_KEYS = ['HKCU\\Software\\Classes\\DesktopBackground\\Shell\\Laqta', 'HKCU\\Software\\Classes\\Directory\\Background\\Shell\\Laqta'];
const MENU_ITEMS = [['1full', 'hkFull', 'full'], ['2region', 'hkRegion', 'region'], ['3screen', 'navRecord', 'screen'],
  ['4camera', 'navCamera', 'camera'], ['5audio', 'navAudio', 'audio'], ['6open', 'openApp', 'open']];
const reg = (...a) => execFileSync('reg', a, { windowsHide: true, stdio: 'ignore' });
function applyContextMenu(on) {
  if (process.platform !== 'win32') return;
  const labels = L();
  const launch = `"${process.execPath}"` + (app.isPackaged ? '' : ` "${app.getAppPath()}"`);
  for (const root of MENU_KEYS) {
    try { reg('delete', root, '/f'); } catch {} // not there yet
    if (!on) continue;
    reg('add', root, '/v', 'MUIVerb', '/d', labels.appName, '/f');
    reg('add', root, '/v', 'Icon', '/d', process.execPath, '/f');
    reg('add', root, '/v', 'SubCommands', '/d', '', '/f');
    for (const [id, label, action] of MENU_ITEMS) {
      reg('add', `${root}\\shell\\${id}`, '/v', 'MUIVerb', '/d', labels[label], '/f');
      reg('add', `${root}\\shell\\${id}\\command`, '/ve', '/d', `${launch} --action=${action}`, '/f');
    }
  }
}

// --action=... comes from the right-click menu (first launch or a second instance)
const actionFrom = argv => (argv.find(a => a.startsWith('--action=')) || '').slice(9);
function runAction(action) {
  if (!action) return;
  if (action === 'full' || action === 'region') return setTimeout(() => screenshot(action, { show: settings.openEditor }), 350); // let the menu disappear
  showWin();
  if (['screen', 'camera', 'audio'].includes(action)) win.webContents.send('action', action);
}
ipcMain.handle('choose-dir', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: settings.outDir });
  if (!r.canceled && r.filePaths[0]) { settings.outDir = r.filePaths[0]; saveSettings(); }
  return settings;
});

ipcMain.handle('screenshot', (e, mode) => screenshot(mode, { show: true }));
ipcMain.handle('capture-source', async (e, id) => {
  const d = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) },
  });
  const src = sources.find(s => s.id === id);
  if (!src || src.thumbnail.isEmpty()) throw new Error('source not available');
  saveShot(src.thumbnail);
});
ipcMain.handle('get-sources', async (e, types) => {
  const sources = await desktopCapturer.getSources({ types, thumbnailSize: { width: 320, height: 180 } });
  return sources.map(s => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL() }));
});
ipcMain.handle('select-region', async () => {
  if (capturing || regionWin) return null;
  try {
    await hideWin();
    const { display, sourceId } = await grabDisplay(false);
    const rect = await selectRegion(display, null);
    return rect && { id: sourceId, rect, displayWidth: display.size.width, name: `${rect.width}×${rect.height}` };
  } finally { win.show(); }
});
ipcMain.handle('set-capture', (e, c) => { pendingCapture = c; });

// recording is streamed to disk chunk by chunk: no RAM growth, no time limit, little loss on crash
let recStream = null, recFile = null, blocker = null;
function startBlocker() { // a sleeping display kills long screen recordings
  try { if (blocker === null || !powerSaveBlocker.isStarted(blocker)) blocker = powerSaveBlocker.start('prevent-display-sleep'); } catch {}
}
function stopBlocker() {
  try { if (blocker !== null && powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker); } catch {}
  blocker = null;
}
function endRec() {
  return new Promise(resolve => {
    stopBlocker();
    if (!recStream) return resolve(null);
    const s = recStream, f = recFile;
    recStream = null;
    s.end(() => resolve(f));
  });
}
ipcMain.handle('rec-open', (e, { ext, prefix }) => {
  recFile = path.join(outDir(), `${prefix}-${stamp()}.${ext}`);
  recStream = fs.createWriteStream(recFile);
  startBlocker();
  return recFile;
});
ipcMain.on('rec-chunk', (e, buf) => { if (recStream) recStream.write(Buffer.from(buf)); });
ipcMain.handle('rec-close', () => endRec());
// a renderer crash must not leave the file open: close it so the recording is still playable
app.on('render-process-gone', () => {
  if (!recStream) return;
  endRec().then(f => f && notify('Laqta', `${L().recSaved}: ${path.basename(f)}`));
});

ipcMain.handle('list-history', () => {
  const dir = outDir();
  return fs.readdirSync(dir)
    .filter(n => /\.(png|jpe?g|mp4|webm|m4a|weba)$/i.test(n))
    .map(n => {
      const p = path.join(dir, n), st = fs.statSync(p);
      return { name: n, path: p, url: pathToFileURL(p).href, size: st.size, mtime: st.mtimeMs,
        type: /\.(png|jpe?g)$/i.test(n) ? 'image' : /\.(m4a|weba)$/i.test(n) ? 'audio' : 'video' };
    })
    .sort((a, b) => b.mtime - a.mtime).slice(0, 120);
});
ipcMain.handle('read-image', (e, p) => nativeImage.createFromPath(p).toDataURL());
ipcMain.handle('copy-image', (e, dataUrl) => clipboard.writeImage(nativeImage.createFromDataURL(dataUrl)));
ipcMain.handle('copy-text', (e, text) => clipboard.writeText(text));
ipcMain.handle('save-image', (e, { dataUrl, file }) => {
  // never overwrite the original capture
  const out = file ? file.replace(/(\.\w+)$/, `-edited-${Date.now()}.png`) : path.join(outDir(), `screenshot-${stamp()}.png`);
  fs.writeFileSync(out, nativeImage.createFromDataURL(dataUrl).toPNG());
  return out;
});
ipcMain.handle('open-path', (e, p) => shell.openPath(p));
ipcMain.handle('show-in-folder', (e, p) => shell.showItemInFolder(p));
ipcMain.handle('open-folder', () => shell.openPath(outDir()));
ipcMain.handle('trash', (e, p) => shell.trashItem(p)); // recycle bin, recoverable
ipcMain.handle('win-minimize', () => win.minimize());
ipcMain.handle('win-show', () => { win.restore(); win.show(); win.focus(); });

// ---------- hotkeys ----------
const ACTIONS = {
  full: () => screenshot('full', { show: settings.openEditor }),
  region: () => screenshot('region', { show: settings.openEditor }),
  rec: () => win.webContents.send('hotkey', 'toggle-rec'),
  pause: () => win.webContents.send('hotkey', 'pause'),
};
// returns the accelerators that could not be registered (taken by another app or invalid)
function registerShortcuts() {
  globalShortcut.unregisterAll();
  return Object.entries(settings.hotkeys).filter(([action, acc]) => {
    if (!acc || !ACTIONS[action]) return false;
    try { return !globalShortcut.register(acc, ACTIONS[action]); } catch { return true; }
  }).map(([, acc]) => acc);
}
ipcMain.handle('set-hotkey', (e, { action, accel }) => {
  if (action) settings.hotkeys[action] = accel; else settings.hotkeys = defaults().hotkeys; // no action = reset all
  saveSettings();
  return { settings, failed: registerShortcuts() };
});
// while the user is typing a new shortcut, global hotkeys must not swallow the keys
ipcMain.handle('hotkeys-suspend', (e, on) => { if (on) globalShortcut.unregisterAll(); else registerShortcuts(); });

app.on('second-instance', (e, argv) => {
  const action = actionFrom(argv);
  if (action) runAction(action); else showWin();
});

app.whenReady().then(() => {
  loadSettings();
  if (settings.contextMenu) try { applyContextMenu(true); } catch {} // keep paths right if the folder moved
  if (settings.startWithWindows) applyStartup();
  session.defaultSession.setDisplayMediaRequestHandler((req, cb) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then(sources => {
      const src = sources.find(s => s.id === pendingCapture.id) || sources[0];
      cb(pendingCapture.loopback ? { video: src, audio: 'loopback' } : { video: src });
    }).catch(() => cb({}));
  });
  createWindow();
  buildTray();
  const failed = registerShortcuts();
  // tell the user instead of silently failing when another app owns a key
  win.webContents.once('did-finish-load', () => {
    if (failed.length) win.webContents.send('hotkeys-failed', failed);
    runAction(actionFrom(process.argv));
  });
});
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopBlocker();
  try { tray && tray.destroy(); } catch {}
});
app.on('window-all-closed', () => { if (!settings?.closeToTray) app.quit(); });
