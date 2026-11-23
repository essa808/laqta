const { dict, scaleRect, codeToAccel, prettyAccel } = I18N;
const $ = id => document.getElementById(id);
let S = {};
const t = k => (dict[S.lang] || dict.ar)[k] ?? k;
const fileName = p => p.split(/[\\/]/).pop();

// ---------- i18n / theme / settings ----------
function applyI18n() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $('langBtn').textContent = S.lang === 'ar' ? 'English' : 'العربية';
  $('srcLabel').textContent = rec.source ? rec.source.name : t('srcAuto');
  document.querySelectorAll('option[value=""]').forEach(o => { o.textContent = t('none'); });
  updateRecUI();
}
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
  $('themeBtn').textContent = S.theme === 'dark' ? '☀' : '🌙';
  $('themeBtn').title = t(S.theme === 'dark' ? 'light' : 'dark');
}
function syncSettings() {
  document.querySelectorAll('[data-setting]').forEach(el => {
    const v = S[el.dataset.setting];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  });
  $('outDir').textContent = S.outDir;
  document.querySelectorAll('[data-hk]').forEach(el => { el.value = prettyAccel(S.hotkeys[el.dataset.hk]) || t('hkOff'); });
  document.querySelectorAll('[data-hk-label]').forEach(el => { el.textContent = prettyAccel(S.hotkeys[el.dataset.hkLabel]); });
}

// ---------- editable hotkeys ----------
async function saveHotkey(action, accel) {
  const r = await api.setHotkey({ action, accel });
  S = r.settings; syncSettings();
  if (r.failed.length) toast(t('hotkeyFail') + r.failed.map(prettyAccel).join(', '));
  else toast(t('hkSaved'));
}
document.querySelectorAll('[data-hk]').forEach(el => {
  el.addEventListener('focus', () => { el.value = t('hkPress'); api.suspendHotkeys(true); });
  el.addEventListener('blur', () => { syncSettings(); api.suspendHotkeys(false); });
  el.addEventListener('keydown', e => {
    e.preventDefault();
    if (e.code === 'Escape') return el.blur();
    if (e.code === 'Backspace') { el.blur(); return saveHotkey(el.dataset.hk, ''); }
    const accel = codeToAccel(e);
    if (accel === '') return; // only modifiers so far
    if (accel === null) return toast(t('hkNeedMod'));
    if (Object.entries(S.hotkeys).some(([k, v]) => k !== el.dataset.hk && v === accel)) return toast(t('hkDup'));
    el.blur(); // re-registers the old set first, then saveHotkey replaces it
    saveHotkey(el.dataset.hk, accel);
  });
});
$('hkReset').onclick = () => saveHotkey(null);
$('goHotkeys').onclick = () => { showPage('settings'); $('hotkeysTitle').scrollIntoView({ behavior: 'smooth' }); };
async function setSetting(k, v) {
  if (k === 'startWithWindows') v = await api.startupSet(!!v); // reflects what Windows actually stored
  S = await api.setSettings({ [k]: v });
  syncSettings();
  if (k === 'lang') applyI18n();
  if (k === 'theme') applyTheme();
}
document.querySelectorAll('[data-setting]').forEach(el => {
  el.addEventListener('change', () => {
    const v = el.type === 'checkbox' ? el.checked : (el.type === 'number' || /^\d+$/.test(el.value) ? +el.value : el.value);
    setSetting(el.dataset.setting, v);
  });
});
$('langBtn').onclick = () => setSetting('lang', S.lang === 'ar' ? 'en' : 'ar');
$('themeBtn').onclick = () => setSetting('theme', S.theme === 'dark' ? 'light' : 'dark');
$('chooseDir').onclick = async () => { S = await api.chooseDir(); syncSettings(); };

// ---------- navigation / toast ----------
let page = 'capture';
function showPage(p) {
  page = p;
  document.querySelectorAll('.page').forEach(x => { x.hidden = x.id !== 'page-' + p; });
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === p));
  if (p === 'history') loadHistory();
  if (p === 'camera') startCamPreview(); else stopCamPreview();
  window.dispatchEvent(new CustomEvent('page', { detail: p })); // the video studio listens for this
}
document.querySelectorAll('.nav button').forEach(b => { b.onclick = () => showPage(b.dataset.page); });
api.on('show-page', p => showPage(p));

function toast(msg, actions = []) {
  const el = document.createElement('div');
  el.className = 'toast';
  const s = document.createElement('span'); s.textContent = msg; el.append(s);
  actions.forEach(([label, fn]) => {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn; el.append(b);
  });
  $('toasts').append(el);
  setTimeout(() => el.remove(), 7000);
}
const fail = e => toast(t('err') + (e && e.message || e));

// ---------- devices ----------
async function loadDevices(askPermission) {
  if (askPermission) { // device labels are empty until permission is granted once
    for (const c of [{ audio: true, video: true }, { audio: true }, { video: true }]) {
      try { (await navigator.mediaDevices.getUserMedia(c)).getTracks().forEach(x => x.stop()); break; } catch {}
    }
  }
  const devs = await navigator.mediaDevices.enumerateDevices();
  const fill = (sel, kind, withNone) => {
    const cur = sel.value, first = !sel.dataset.init;
    sel.innerHTML = '';
    if (withNone) sel.add(new Option(t('none'), ''));
    devs.filter(d => d.kind === kind).forEach((d, i) => sel.add(new Option(d.label || `${kind} ${i + 1}`, d.deviceId)));
    if ([...sel.options].some(o => o.value === cur) && !first) sel.value = cur;
    else if (withNone && sel.options.length > 1) sel.selectedIndex = 1; // mic on by default: "no audio" is the #1 complaint
    sel.dataset.init = 1;
  };
  fill($('recMic'), 'audioinput', true); fill($('camMic'), 'audioinput', true); fill($('audMic'), 'audioinput', true);
  fill($('recCam'), 'videoinput', false); fill($('camDevice'), 'videoinput', false);
}
navigator.mediaDevices.ondevicechange = () => loadDevices(false);

// ---------- source picker ----------
function pickSource(types) {
  return new Promise(async resolve => {
    const list = await api.getSources(types);
    if (types[0] === 'screen' && list.length === 1) return resolve(list[0]);
    const grid = $('srcGrid'); grid.innerHTML = '';
    list.forEach(s => {
      const b = document.createElement('button'); b.className = 'src';
      const img = document.createElement('img'); img.src = s.thumb;
      const name = document.createElement('span'); name.textContent = s.name;
      b.append(img, name);
      b.onclick = () => { resolve(s); $('srcModal').close(); };
      grid.append(b);
    });
    $('srcModal').onclose = () => resolve(null);
    $('srcCancel').onclick = () => $('srcModal').close();
    $('srcModal').showModal();
  });
}

// ---------- screenshots ----------
$('shotFull').onclick = () => api.screenshot('full');
$('shotRegion').onclick = () => api.screenshot('region');
$('shotWindow').onclick = async () => { const s = await pickSource(['window']); if (s) api.captureSource(s.id).catch(fail); };
api.on('screenshot-taken', d => { openEditor(d); toast(`${t('saved')}${S.autoCopy ? ' + ' + t('copied') : ''}: ${fileName(d.file)}`); });
api.on('error', msg => fail(msg));

// ---------- editor ----------
const ed = { img: null, shapes: [], file: null, tool: 'pen', drawing: null };
const cv = $('edCanvas'), cx = cv.getContext('2d');
function openEditor({ file, dataUrl }) {
  showPage('capture');
  const img = new Image();
  img.onload = () => {
    Object.assign(ed, { img, shapes: [], file });
    cv.width = img.width; cv.height = img.height;
    $('editor').hidden = false; redraw();
  };
  img.src = dataUrl;
}
document.querySelectorAll('.tool').forEach(b => {
  b.onclick = () => {
    ed.tool = b.dataset.tool;
    document.querySelectorAll('.tool').forEach(x => x.classList.toggle('active', x === b));
    if (ed.tool === 'text') $('edText').focus();
  };
});
const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
cv.onpointerdown = e => {
  if (!ed.img) return;
  const p = pos(e);
  const base = { tool: ed.tool, color: $('edColor').value, size: +$('edSize').value * cv.width / cv.getBoundingClientRect().width };
  if (ed.tool === 'text') {
    const text = $('edText').value.trim();
    if (text) { ed.shapes.push({ ...base, x: p.x, y: p.y, text }); redraw(); }
    return;
  }
  ed.drawing = { ...base, x1: p.x, y1: p.y, x2: p.x, y2: p.y, pts: [p] };
  cv.setPointerCapture(e.pointerId);
};
cv.onpointermove = e => {
  if (!ed.drawing) return;
  const p = pos(e); Object.assign(ed.drawing, { x2: p.x, y2: p.y }); ed.drawing.pts.push(p); redraw(ed.drawing);
};
cv.onpointerup = () => { if (ed.drawing) { ed.shapes.push(ed.drawing); ed.drawing = null; redraw(); } };

function drawShape(s) {
  const g = cx; g.save();
  g.strokeStyle = g.fillStyle = s.color; g.lineWidth = s.size; g.lineCap = g.lineJoin = 'round';
  const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2), w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
  switch (s.tool) {
    case 'pen': g.beginPath(); s.pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); break;
    case 'rect': g.strokeRect(x, y, w, h); break;
    case 'highlight': g.globalAlpha = 0.35; g.fillRect(x, y, w, h); break;
    case 'arrow': {
      const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), L = s.size * 4;
      g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
      g.beginPath(); g.moveTo(s.x2, s.y2);
      g.lineTo(s.x2 - L * Math.cos(a - 0.5), s.y2 - L * Math.sin(a - 0.5));
      g.lineTo(s.x2 - L * Math.cos(a + 0.5), s.y2 - L * Math.sin(a + 0.5)); g.closePath(); g.fill(); break;
    }
    case 'blur': if (w > 2 && h > 2) { // pixelate from the original image: irreversible in the exported PNG
      const k = Math.max(6, s.size * 3), tw = Math.max(1, Math.round(w / k)), th = Math.max(1, Math.round(h / k));
      const tmp = new OffscreenCanvas(tw, th); tmp.getContext('2d').drawImage(ed.img, x, y, w, h, 0, 0, tw, th);
      g.imageSmoothingEnabled = false; g.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
    } break;
    case 'text':
      g.font = `bold ${Math.round(s.size * 6)}px "Segoe UI", Tahoma, sans-serif`; g.textBaseline = 'top';
      g.direction = /[؀-ۿ]/.test(s.text) ? 'rtl' : 'ltr';
      g.lineWidth = Math.max(2, s.size); g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(s.text, s.x, s.y); g.fillText(s.text, s.x, s.y); break;
  }
  g.restore();
}
function redraw(extra) { cx.drawImage(ed.img, 0, 0); ed.shapes.forEach(drawShape); if (extra) drawShape(extra); }
$('edUndo').onclick = () => { ed.shapes.pop(); redraw(); };
$('edCopy').onclick = async () => { await api.copyImage(cv.toDataURL()); toast(t('copied')); };
$('edSave').onclick = async () => {
  const out = await api.saveImage({ dataUrl: cv.toDataURL(), file: ed.file });
  toast(`${t('saved')}: ${fileName(out)}`, [[t('showInFolder'), () => api.showInFolder(out)]]);
};
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key.toLowerCase() === 'z' && page === 'capture' && document.activeElement !== $('edText') && ed.img) { ed.shapes.pop(); redraw(); }
});

// ---------- recording ----------
const rec = { active: false, paused: false, mode: null, source: null, recorder: null, streams: [], drawTimer: null,
  tick: null, elapsed: 0, last: 0, chain: Promise.resolve(), audioCtx: null, mixDest: null, micNode: null, micStream: null, opened: false };

$('srcScreen').onclick = async () => { const s = await pickSource(['screen']); if (s) setSource(s); };
$('srcWindow').onclick = async () => { const s = await pickSource(['window']); if (s) setSource(s); };
$('srcRegion').onclick = async () => { try { const s = await api.selectRegion(); if (s) setSource(s); } catch (e) { fail(e); } };
function setSource(s) { rec.source = s; $('srcLabel').textContent = s.name; }
$('webcamOn').onchange = () => { $('webcamOpts').hidden = !$('webcamOn').checked; };

async function playStream(stream) {
  const v = document.createElement('video'); v.muted = true; v.srcObject = stream; await v.play();
  if (!v.videoWidth) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
  return v;
}
async function attachMic(id) { // also used to switch microphone mid-recording
  if (rec.micNode) { rec.micNode.disconnect(); rec.micStream.getTracks().forEach(x => x.stop()); rec.micNode = rec.micStream = null; }
  if (!id) return;
  rec.micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id }, echoCancellation: true, noiseSuppression: true } });
  rec.micNode = rec.audioCtx.createMediaStreamSource(rec.micStream);
  rec.micNode.connect(rec.mixDest);
}
const MIC_SELECT = { screen: 'recMic', camera: 'camMic', audio: 'audMic' };
Object.entries(MIC_SELECT).forEach(([mode, id]) => {
  $(id).onchange = () => { if (rec.active && rec.mode === mode) attachMic($(id).value).catch(fail); };
});

// Tries the chosen camera, then the others. Virtual cameras (e.g. ByteCast) fail with NotReadableError
// when their app is closed, so we explain that instead of showing the raw browser message.
async function openCamera(preferId, extra = {}) {
  const ids = [...$('camDevice').options].map(o => o.value).filter(Boolean);
  const order = [preferId, ...ids.filter(i => i !== preferId)].filter(Boolean);
  if (!order.length) throw new Error(t('noCamera'));
  let last;
  for (const id of order) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { ...extra, deviceId: { exact: id } } });
      $('camDevice').value = $('recCam').value = id;
      return s;
    } catch (e) { last = e; }
  }
  throw new Error(t(last.name === 'NotAllowedError' ? 'camDenied' : last.name === 'NotReadableError' ? 'camBusy' : 'noCamera'));
}

function drawBubble(g, v, W, H, mirror) {
  const d = Math.round(Math.min(W, H) * (+$('camSize').value / 100)), m = Math.round(d * 0.12), p = $('camPos').value;
  const x = p.includes('r') ? W - d - m : m, y = p.includes('b') ? H - d - m : m;
  const s = Math.min(v.videoWidth, v.videoHeight), sx = (v.videoWidth - s) / 2, sy = (v.videoHeight - s) / 2;
  g.save(); g.beginPath(); g.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); g.clip();
  if (mirror) { g.translate(2 * x + d, 0); g.scale(-1, 1); }
  g.drawImage(v, sx, sy, s, s, x, y, d, d); g.restore();
  g.beginPath(); g.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
  g.lineWidth = Math.max(2, d * 0.03); g.strokeStyle = '#fff'; g.stroke();
}

function countdown(n) {
  return new Promise(resolve => {
    if (!n) return resolve();
    const el = $('countdown'); el.hidden = false; el.textContent = n;
    const iv = setInterval(() => { n--; if (n <= 0) { clearInterval(iv); el.hidden = true; resolve(); } else el.textContent = n; }, 1000);
  });
}

async function startRecording(mode) {
  if (rec.active) return;
  rec.active = true; rec.mode = mode; updateRecUI();
  try {
    const fps = +S.fps;
    const sysAudio = (mode === 'screen' && $('sysAudio').checked) || (mode === 'audio' && $('audSys').checked);
    let screenV = null, camV = null, hasSys = false;
    rec.audioCtx = new AudioContext(); rec.mixDest = rec.audioCtx.createMediaStreamDestination();
    if (mode === 'screen' || (mode === 'audio' && sysAudio)) {
      const src = (mode === 'screen' && rec.source) || (await api.getSources(['screen']))[0];
      await api.setCapture({ id: src.id, loopback: sysAudio });
      const ss = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: fps }, audio: sysAudio });
      rec.streams.push(ss);
      if (mode === 'screen') {
        screenV = await playStream(ss);
        ss.getVideoTracks()[0].onended = stopRecording; // recorded window closed -> save what we have
      } else ss.getVideoTracks().forEach(x => x.stop()); // audio only: system sound is all we need
      hasSys = sysAudio && ss.getAudioTracks().length > 0;
      if (hasSys) rec.audioCtx.createMediaStreamSource(new MediaStream(ss.getAudioTracks())).connect(rec.mixDest);
    }
    if (mode === 'camera') {
      stopCamPreview(); // some webcams can't be opened twice
      const [w, h] = $('camRes').value.split('x').map(Number);
      const cs = await openCamera($('camDevice').value, { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: fps } });
      rec.streams.push(cs); camV = await playStream(cs);
    } else if (mode === 'screen' && $('webcamOn').checked) {
      try { // a broken webcam must not cancel the screen recording
        const cs = await openCamera($('recCam').value, { width: { ideal: 640 }, height: { ideal: 480 } });
        rec.streams.push(cs); camV = await playStream(cs);
      } catch (e) { toast(e.message); }
    }
    await attachMic($(MIC_SELECT[mode]).value);
    if (mode === 'audio') return await startAudioOnly(hasSys);

    const canvas = $('recCanvas'), g = canvas.getContext('2d');
    const crop = screenV && rec.source && rec.source.rect
      ? scaleRect(rec.source.rect, rec.source.displayWidth, screenV.videoWidth, screenV.videoHeight) : null;
    const base = screenV || camV;
    canvas.width = crop ? crop.width : base.videoWidth & ~1;
    canvas.height = crop ? crop.height : base.videoHeight & ~1;
    const W = canvas.width, H = canvas.height;
    const mirrorCam = mode === 'camera' ? $('camMirror').checked : true;
    const fit = v => { // window sizes can change mid-recording: letterbox instead of stretching
      const s = Math.min(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
    };
    const draw = () => {
      if (screenV) {
        if (crop) g.drawImage(screenV, crop.x, crop.y, crop.width, crop.height, 0, 0, W, H); else fit(screenV);
        if (camV) drawBubble(g, camV, W, H, true);
      } else {
        g.save(); if (mirrorCam) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(camV, 0, 0, W, H); g.restore();
      }
    };
    $(mode === 'camera' ? 'camSlot' : 'recSlot').append(canvas);
    $('camPreview').hidden = mode === 'camera';
    draw();

    const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m));
    const bps = Math.min(40e6, Math.max(1e6, W * H * fps * ({ high: 0.12, medium: 0.07, low: 0.035 }[S.quality] || 0.07)));

    await countdown(+S.countdown);
    if (!rec.active) return; // stopped during countdown
    if (S.hideOnRecord && mode === 'screen') api.minimize();
    rec.drawTimer = setInterval(draw, 1000 / fps);

    const out = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...rec.mixDest.stream.getAudioTracks()]);
    await beginRecorder(out, mime, mime.startsWith('video/mp4') ? 'mp4' : 'webm', { videoBitsPerSecond: bps });
  } catch (e) {
    fail(e); cleanup(); api.showWindow();
  }
}

async function beginRecorder(out, mimeType, ext, opts = {}) {
  await api.recOpen({ ext, prefix: rec.mode });
  rec.opened = true;
  rec.chain = Promise.resolve();
  rec.recorder = new MediaRecorder(out, { mimeType, audioBitsPerSecond: 160000, ...opts });
  rec.recorder.ondataavailable = e => {
    if (e.data.size) rec.chain = rec.chain.then(async () => api.recChunk(await e.data.arrayBuffer()));
  };
  rec.recorder.onstop = finish;
  rec.recorder.start(1000); // 1s chunks go straight to disk
  rec.elapsed = 0; rec.last = performance.now(); rec.paused = false;
  rec.tick = setInterval(updateTimer, 250);
  updateRecUI();
}

async function startAudioOnly(hasSys) {
  if (!rec.micNode && !hasSys) throw new Error(t('noAudioSrc'));
  const mime = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
    .find(m => MediaRecorder.isTypeSupported(m));
  const an = rec.audioCtx.createAnalyser(); an.fftSize = 1024;
  rec.audioCtx.createMediaStreamSource(rec.mixDest.stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  await countdown(+S.countdown);
  if (!rec.active) return;
  rec.drawTimer = setInterval(() => { // live level meter so you can see the mic is picking up sound
    an.getFloatTimeDomainData(buf);
    let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
    $('audLevel').style.width = Math.min(100, peak * 140) + '%';
  }, 60);
  await beginRecorder(rec.mixDest.stream, mime, mime.startsWith('audio/mp4') ? 'm4a' : 'weba');
}

function stopRecording() {
  if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
  else if (rec.active) { cleanup(); api.showWindow(); }
}
function togglePause() {
  if (!rec.recorder || rec.recorder.state === 'inactive') return;
  if (rec.paused) { rec.recorder.resume(); rec.last = performance.now(); } else { updateTimer(); rec.recorder.pause(); }
  rec.paused = !rec.paused; updateRecUI();
}
async function finish() {
  await rec.chain;
  const file = await api.recClose();
  rec.opened = false;
  const mode = rec.mode;
  cleanup();
  api.showWindow();
  if (file) {
    const actions = [[t('open'), () => api.openPath(file)], [t('showInFolder'), () => api.showInFolder(file)]];
    if (window.Studio && (mode === 'screen' || mode === 'camera')) actions.push([t('videoEdit'), () => window.Studio.openPath(file)]);
    toast(t('recSaved') + ': ' + fileName(file), actions);
  }
  if (page === 'history') loadHistory();
}
function cleanup() {
  clearInterval(rec.drawTimer); clearInterval(rec.tick);
  rec.streams.forEach(s => s.getTracks().forEach(x => x.stop()));
  if (rec.micStream) rec.micStream.getTracks().forEach(x => x.stop());
  if (rec.audioCtx) rec.audioCtx.close();
  if (rec.opened) { rec.opened = false; api.recClose().catch(() => {}); } // a failed start must not leave the file open
  Object.assign(rec, { active: false, paused: false, recorder: null, streams: [], audioCtx: null, mixDest: null, micNode: null, micStream: null });
  $('countdown').hidden = true;
  $('audLevel').style.width = '0';
  $('camPreview').hidden = false;
  $('recSlot').append($('recCanvas'));
  document.title = 'Laqta';
  updateRecUI();
  if (page === 'camera') startCamPreview();
}
const fmt = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), mm = String(Math.floor(s / 60) % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0'); return (h ? h + ':' : '') + mm + ':' + ss; };
function updateTimer() {
  if (!rec.paused) { const now = performance.now(); rec.elapsed += now - rec.last; rec.last = now; }
  $('recTime').textContent = fmt(rec.elapsed);
  document.title = `● ${fmt(rec.elapsed)} — Laqta`; // visible on the taskbar while minimized
}
function updateRecUI() {
  const live = !!rec.recorder;
  $('recBar').hidden = !live;
  $('recBar').classList.toggle('paused', rec.paused);
  $('recState').textContent = t(rec.paused ? 'paused' : 'recording');
  $('pauseBtn').textContent = t(rec.paused ? 'resume' : 'pause');
  $('recStart').disabled = $('camStart').disabled = $('audStart').disabled = rec.active;
}
$('recStart').onclick = () => startRecording('screen');
$('camStart').onclick = () => startRecording('camera');
$('audStart').onclick = () => startRecording('audio');
$('stopBtn').onclick = stopRecording;
$('pauseBtn').onclick = togglePause;
api.on('hotkey', k => {
  if (k === 'toggle-rec') rec.active ? stopRecording() : startRecording(page === 'camera' || page === 'audio' ? page : 'screen');
  if (k === 'pause') togglePause();
});
api.on('hotkeys-failed', keys => toast(t('hotkeyFail') + keys.join(', ')));
let booted; const bootReady = new Promise(r => { booted = r; });
api.on('action', async mode => { // from the Windows right-click menu
  await bootReady; // devices must be listed before recording
  if (rec.active) return;
  showPage(mode === 'screen' ? 'record' : mode);
  startRecording(mode);
});
window.addEventListener('beforeunload', () => { if (rec.recorder) rec.recorder.stop(); });

// ---------- camera preview ----------
let camPrev = null;
async function startCamPreview() {
  if (rec.active) return;
  stopCamPreview();
  try {
    camPrev = await openCamera($('camDevice').value);
    $('camPreview').srcObject = camPrev;
    $('camMsg').hidden = true; $('camPreview').hidden = false;
  } catch (e) { // explain inside the panel instead of a bare error toast
    $('camMsgText').textContent = e.message;
    $('camMsg').hidden = false; $('camPreview').hidden = true;
  }
}
$('camRetry').onclick = async () => { await loadDevices(false); startCamPreview(); };
function stopCamPreview() { if (camPrev) camPrev.getTracks().forEach(x => x.stop()); camPrev = null; $('camPreview').srcObject = null; }
$('camDevice').onchange = startCamPreview;
const mirrorPrev = () => { $('camPreview').style.transform = $('camMirror').checked ? 'scaleX(-1)' : ''; };
$('camMirror').onchange = mirrorPrev;

// ---------- history ----------
async function loadHistory() {
  const items = await api.listHistory();
  const grid = $('histGrid'); grid.innerHTML = '';
  $('histEmpty').hidden = items.length > 0;
  for (const it of items) {
    const card = document.createElement('div'); card.className = 'card';
    const media = document.createElement(it.type === 'image' ? 'img' : it.type);
    media.src = it.url; if (it.type !== 'image') { media.preload = 'metadata'; media.controls = true; } else media.loading = 'lazy';
    const meta = document.createElement('div'); meta.className = 'meta';
    const b = document.createElement('b'); b.textContent = it.name;
    const info = document.createElement('span'); info.className = 'muted';
    info.textContent = `${(it.size / 1048576).toFixed(1)} MB · ${new Date(it.mtime).toLocaleString(S.lang === 'ar' ? 'ar' : 'en')}`;
    meta.append(b, info);
    const row = document.createElement('div'); row.className = 'row';
    const btn = (k, fn) => { const x = document.createElement('button'); x.textContent = t(k); x.onclick = fn; row.append(x); return x; };
    btn('open', () => api.openPath(it.path));
    if (it.type === 'image') btn('edit', async () => openEditor({ file: it.path, dataUrl: await api.readImage(it.path) }));
    if (it.type === 'video' && window.Studio) btn('videoEdit', () => window.Studio.openPath(it.path));
    btn('showInFolder', () => api.showInFolder(it.path));
    btn('copyPath', async () => { await api.copyText(it.path); toast(t('copied')); });
    const del = btn('del', () => {});
    del.onclick = async () => {
      if (del.dataset.armed !== '1') { // two-step delete: one click never removes a file
        del.dataset.armed = '1'; del.textContent = t('confirmDelete');
        setTimeout(() => { if (del.isConnected) { del.dataset.armed = '0'; del.textContent = t('del'); } }, 2500);
        return;
      }
      await api.trash(it.path); toast(t('trashed')); loadHistory();
    };
    card.append(media, meta, row); grid.append(card);
  }
}
$('histRefresh').onclick = loadHistory;
$('histFolder').onclick = () => api.openFolder();

// ---------- boot ----------
(async () => {
  S = await api.getSettings();
  applyTheme(); syncSettings(); applyI18n(); mirrorPrev();
  await loadDevices(true).catch(fail);
  booted();
})();
