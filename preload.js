const { contextBridge, ipcRenderer } = require('electron');

const inv = ch => (...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('api', {
  getSettings: inv('get-settings'), setSettings: inv('set-settings'), chooseDir: inv('choose-dir'),
  startupSet: inv('startup-set'), chooseVideo: inv('choose-video'), fileUrl: inv('file-url'),
  screenshot: inv('screenshot'), captureSource: inv('capture-source'), getSources: inv('get-sources'),
  selectRegion: inv('select-region'), setCapture: inv('set-capture'),
  recOpen: inv('rec-open'), recChunk: buf => ipcRenderer.send('rec-chunk', buf), recClose: inv('rec-close'),
  listHistory: inv('list-history'), readImage: inv('read-image'), copyImage: inv('copy-image'), copyText: inv('copy-text'),
  saveImage: inv('save-image'), openPath: inv('open-path'), showInFolder: inv('show-in-folder'),
  openFolder: inv('open-folder'), trash: inv('trash'), minimize: inv('win-minimize'), showWindow: inv('win-show'),
  setHotkey: inv('set-hotkey'), suspendHotkeys: inv('hotkeys-suspend'),
  regionInit: inv('region-init'), regionDone: rect => ipcRenderer.send('region-done', rect),
  on: (ch, cb) => ipcRenderer.on(ch, (e, d) => cb(d)),
});
