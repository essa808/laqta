// Video studio: trim a recording and burn text / emoji stickers over it.
// Export re-renders the frame through a canvas and records it in real time,
// reusing the same chunk-to-disk pipeline as the recorder.
(() => {
  const el = id => document.getElementById(id);
  const video = el('stVideo'), canvas = el('stCanvas'), ctx = canvas.getContext('2d');
  const stage = el('stStage');
  const state = {
    path: null, url: null, duration: 0, trim: { s: 0, e: 0 },
    overlays: [], sel: null, playing: false, exporting: false, exp: null,
    dirty: true, raf: 0, drag: null, boxes: new Map(),
    ac: null, src: null, dest: null,
  };
  let nextId = 1;

  const baseName = p => String(p || '').split(/[\\/]/).pop();
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const fmtTime = s => {
    s = Math.max(0, s || 0);
    if (!isFinite(s)) return '—';
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = Math.floor(s % 60);
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(ss).padStart(2, '0');
  };
  const once = (target, ev) => new Promise(r => target.addEventListener(ev, r, { once: true }));

  // ---------- loading ----------
  async function openPath(p) {
    if (!p) return;
    try {
      const url = await api.fileUrl(p);
      showPage('studio');
      load(p, url);
    } catch (e) { toast(t('err') + (e && e.message || e)); }
  }

  function load(path, url) {
    state.path = path; state.url = url;
    state.overlays = []; state.sel = null; state.dirty = true;
    state.trim = { s: 0, e: 0 };
    el('stName').textContent = baseName(path);
    stage.classList.remove('has-video');
    video.pause();
    video.src = url;
    video.load();
    el('stExport').disabled = true;
    el('stTrim').textContent = '';
    renderLayers();
  }

  function applyMeta() {
    const d = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    state.duration = d;
    if (d) {
      state.trim = { s: 0, e: d };
      for (const o of state.overlays) o.end = Math.min(o.end, d); // layers added before the duration was known
    }
    el('stExport').disabled = !d;
    updateTrimUI(); updateTimeUI(); state.dirty = true;
  }

  video.addEventListener('loadedmetadata', () => {
    const W = (video.videoWidth || 1280) & ~1, H = (video.videoHeight || 720) & ~1;
    canvas.width = Math.max(2, W); canvas.height = Math.max(2, H);
    stage.classList.add('has-video');
    applyMeta();
    if (!state.duration) {
      // MediaRecorder WebM files carry no duration until the file has been scanned:
      // seeking past the end makes Chromium scan it, then we jump back to the start.
      const onDur = () => {
        if (!isFinite(video.duration) || video.duration <= 0) return;
        video.removeEventListener('durationchange', onDur);
        video.currentTime = 0;
        applyMeta();
      };
      video.addEventListener('durationchange', onDur);
      try { video.currentTime = 1e7; } catch {}
    }
  });
  video.addEventListener('error', () => {
    toast(t('err') + (video.error && video.error.message || 'unsupported video'));
    stage.classList.remove('has-video');
    el('stExport').disabled = true;
  });
  video.addEventListener('play', () => { state.playing = true; updatePlayBtn(); });
  video.addEventListener('pause', () => { state.playing = false; updatePlayBtn(); });
  // the first decoded frame can arrive after loadedmetadata: redraw so the canvas isn't left black.
  // A MediaRecorder MP4 has no decodable frame at exactly 0, so nudge off zero to force one.
  video.addEventListener('loadeddata', () => {
    state.dirty = true;
    if (video.currentTime === 0) { try { video.currentTime = 0.001; } catch {} }
  });
  video.addEventListener('canplay', () => { state.dirty = true; });
  video.addEventListener('timeupdate', () => { state.dirty = true; if (!state.exporting) updateTimeUI(); });
  video.addEventListener('seeked', () => { state.dirty = true; });
  video.addEventListener('ended', () => { state.playing = false; updatePlayBtn(); });

  function updatePlayBtn() { el('stPlay').textContent = state.playing ? '⏸' : '▶'; }
  function updateTimeUI() {
    if (!state.duration) return;
    el('stSeek').value = Math.round((video.currentTime / state.duration) * 1000);
    el('stTime').textContent = fmtTime(video.currentTime) + ' / ' + fmtTime(state.duration);
  }
  function updateTrimUI() {
    el('stTrim').textContent = state.duration
      ? `${fmtTime(state.trim.s)} – ${fmtTime(state.trim.e)}  (${fmtTime(state.trim.e - state.trim.s)})` : '';
  }
  function updateExportBtn() {
    const b = el('stExport');
    b.disabled = !state.url || !state.duration || state.exporting;
    if (state.exporting && state.exp) {
      const p = Math.min(100, Math.round(((video.currentTime - state.exp.s) / (state.exp.e - state.exp.s || 1)) * 100));
      b.textContent = `${t('exporting')} ${p}%`;
    } else b.textContent = t('export');
  }

  // ---------- drawing ----------
  const layerPx = o => o.type === 'sticker' ? (o.size / 100) * canvas.width : (o.size * canvas.width) / 1280;
  const active = o => { const now = video.currentTime; return now >= o.start - 0.001 && now <= o.end + 0.001; };
  const SIZE = { text: [12, 320], sticker: [4, 120] };
  const clampSize = (o, v) => {
    const [lo, hi] = SIZE[o.type] || SIZE.text;
    return Math.round(Math.min(hi, Math.max(lo, v || 0)) * 10) / 10;
  };
  const syncSize = () => {
    const o = state.overlays.find(x => x.id === state.sel);
    if (o && o.type === 'text') el('stSize').value = Math.round(o.size);
  };

  function drawLayer(o) {
    const px = layerPx(o);
    const x = o.x * canvas.width, y = o.y * canvas.height;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (o.type === 'sticker') {
      ctx.font = `${px}px "Segoe UI Emoji", "Segoe UI Symbol", sans-serif`;
      ctx.fillStyle = '#fff';
    } else {
      ctx.font = `bold ${px}px "Segoe UI", Tahoma, sans-serif`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, px * 0.12);
      ctx.strokeStyle = 'rgba(0,0,0,.65)';
      ctx.strokeText(o.text, x, y);
      ctx.fillStyle = o.color || '#fff';
    }
    ctx.fillText(o.text, x, y);
    const m = ctx.measureText(o.text);
    ctx.restore();
    const w = m.width, h = px * 1.15;
    state.boxes.set(o.id, { x: x - w / 2, y: y - h / 2, w, h });
  }

  function draw() {
    if (!video.readyState) return;
    const W = canvas.width, H = canvas.height;
    ctx.drawImage(video, 0, 0, W, H);
    state.boxes.clear();
    for (const o of state.overlays) if (active(o)) drawLayer(o);
    if (state.sel) {
      const b = state.boxes.get(state.sel);
      if (b) {
        ctx.save();
        ctx.setLineDash([10, 6]); ctx.lineWidth = Math.max(2, W * 0.002); ctx.strokeStyle = '#4f8cff';
        ctx.strokeRect(b.x - 10, b.y - 10, b.w + 20, b.h + 20);
        ctx.restore();
        drawHandles(b);
      }
    }
  }

  // corner squares scale the selected layer: drag them, or use the mouse wheel
  const handleSide = () => Math.max(9, canvas.width * 0.012) * 1.6;
  const corners = b => ({
    nw: [b.x, b.y], ne: [b.x + b.w, b.y], sw: [b.x, b.y + b.h], se: [b.x + b.w, b.y + b.h],
  });
  function drawHandles(b) {
    const s = handleSide();
    ctx.save();
    ctx.lineWidth = Math.max(1.5, canvas.width * 0.0015);
    for (const [x, y] of Object.values(corners(b))) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#4f8cff';
      ctx.beginPath(); ctx.rect(x - s / 2, y - s / 2, s, s); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function handleHit(p) {
    if (!state.sel) return null;
    const b = state.boxes.get(state.sel);
    if (!b) return null;
    const x = p.x * canvas.width, y = p.y * canvas.height, r = Math.max(18, canvas.width * 0.03);
    for (const [k, [cx, cy]] of Object.entries(corners(b))) if (Math.hypot(x - cx, y - cy) <= r) return k;
    return null;
  }

  function loop() {
    state.raf = requestAnimationFrame(loop);
    if (!state.url || video.readyState < 2) return;
    if (state.playing || state.exporting || state.dirty) {
      draw();
      state.dirty = false;
      if (state.exporting) updateExportBtn();
    }
  }

  // ---------- layers ----------
  function addOverlay(o) {
    if (!state.duration) return; // duration not scanned yet (or the video is broken)
    const now = video.currentTime || 0;
    let start = Math.min(now, Math.max(0, state.duration - 0.6));
    let end = Math.min(state.duration, start + 3);
    if (end - start < 0.6) { start = Math.max(0, state.duration - 1); end = state.duration; }
    const layer = { id: nextId++, x: 0.5, y: 0.4, start, end, ...o };
    state.overlays.push(layer);
    state.sel = layer.id;
    state.dirty = true;
    renderLayers();
    return layer;
  }

  function renderLayers() {
    const box = el('stLayers'); box.innerHTML = '';
    if (!state.overlays.length) {
      const p = document.createElement('p'); p.className = 'muted small'; p.textContent = '—'; box.append(p);
      return;
    }
    for (const o of [...state.overlays].reverse()) {
      const row = document.createElement('div');
      row.className = 'layer' + (o.id === state.sel ? ' sel' : '');
      const b = document.createElement('b');
      b.textContent = o.type === 'sticker' ? o.text : o.text;
      const time = document.createElement('small');
      time.dir = 'ltr';
      time.textContent = `${fmtTime(o.start)}–${fmtTime(o.end)}`;
      const mk = (label, title, fn) => {
        const x = document.createElement('button');
        x.textContent = label; x.title = title;
        x.onclick = e => { e.stopPropagation(); fn(); };
        return x;
      };
      const startBtn = mk('⇤', t('setStart'), () => { o.start = Math.min(video.currentTime, o.end - 0.2); state.dirty = true; renderLayers(); });
      const endBtn = mk('⇥', t('setEnd'), () => { o.end = Math.max(video.currentTime, o.start + 0.2); state.dirty = true; renderLayers(); });
      const delBtn = mk('🗑', t('del'), () => {
        state.overlays = state.overlays.filter(x => x !== o);
        if (state.sel === o.id) state.sel = null;
        state.dirty = true; renderLayers();
      });
      row.append(b, time, startBtn, endBtn, delBtn);
      row.onclick = () => { state.sel = o.id; state.dirty = true; renderLayers(); };
      box.append(row);
    }
    syncSize();
  }

  // ---------- pointer: select + drag ----------
  const norm = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  function hitTest(p) {
    const x = p.x * canvas.width, y = p.y * canvas.height;
    for (const o of [...state.overlays].reverse()) {
      if (!active(o)) continue;
      const b = state.boxes.get(o.id);
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return o;
    }
    return null;
  }
  canvas.addEventListener('pointerdown', e => {
    if (!state.url || state.exporting) return;
    const p = norm(e);
    const corner = handleHit(p);
    if (corner) {
      const o = state.overlays.find(x => x.id === state.sel);
      if (!o) return;
      const cx = o.x * canvas.width, cy = o.y * canvas.height;
      state.drag = { mode: 'resize', id: o.id, start: o.size, dist: Math.max(1, Math.hypot(p.x * canvas.width - cx, p.y * canvas.height - cy)) };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    const hit = hitTest(p);
    if (hit) {
      state.sel = hit.id;
      state.drag = { mode: 'move', id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      canvas.classList.add('dragging');
      renderLayers(); syncSize();
    } else state.sel = null;
    state.dirty = true;
    renderLayers();
  });
  canvas.addEventListener('pointermove', e => {
    const p = norm(e);
    if (!state.drag) {
      if (!state.url || state.exporting) return;
      const corner = handleHit(p);
      canvas.style.cursor = corner
        ? (corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize')
        : (hitTest(p) ? 'move' : 'default');
      return;
    }
    const o = state.overlays.find(x => x.id === state.drag.id);
    if (!o) return;
    if (state.drag.mode === 'resize') {
      const cx = o.x * canvas.width, cy = o.y * canvas.height;
      const d = Math.hypot(p.x * canvas.width - cx, p.y * canvas.height - cy);
      o.size = clampSize(o, state.drag.start * (d / state.drag.dist));
      syncSize();
    } else {
      o.x = clamp01(p.x - state.drag.dx);
      o.y = clamp01(p.y - state.drag.dy);
    }
    state.dirty = true;
  });
  const endDrag = () => { state.drag = null; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e => {
    if (!state.url || state.exporting) return;
    let o = state.overlays.find(x => x.id === state.sel);
    if (!o) o = hitTest(norm(e));
    if (!o) return;
    e.preventDefault();
    o.size = clampSize(o, o.size * Math.exp(-e.deltaY * 0.0015));
    state.sel = o.id;
    state.dirty = true; syncSize(); renderLayers();
  }, { passive: false });

  // ---------- controls ----------
  el('stOpen').onclick = async () => {
    const v = await api.chooseVideo();
    if (!v) return;
    showPage('studio');
    load(v.path, v.url);
  };

  el('stPlay').onclick = async () => {
    if (!state.url) return toast(t('studioNoVideo'));
    await ensureAudio();
    if (video.paused) {
      if (video.currentTime >= state.trim.e - 0.05 && state.trim.e > 0) video.currentTime = state.trim.s;
      video.play().catch(e => toast(String(e.message || e)));
    } else video.pause();
    state.dirty = true;
  };
  el('stSeek').oninput = () => {
    if (state.duration) { video.currentTime = (el('stSeek').value / 1000) * state.duration; state.dirty = true; updateTimeUI(); }
  };
  el('stSetIn').onclick = () => {
    if (!state.url) return;
    state.trim.s = Math.max(0, Math.min(video.currentTime, state.trim.e - 0.2));
    state.trim.e = Math.max(state.trim.s + 0.2, state.trim.e);
    updateTrimUI();
  };
  el('stSetOut').onclick = () => {
    if (!state.url) return;
    state.trim.e = Math.max(state.trim.s + 0.2, Math.min(video.currentTime || state.duration, state.duration));
    updateTrimUI();
  };
  el('stAddText').onclick = () => {
    if (!state.url) return toast(t('studioNoVideo'));
    const text = el('stText').value.trim();
    if (!text) return el('stText').focus();
    const size = Math.max(12, Math.min(320, +el('stSize').value || 42));
    addOverlay({ type: 'text', text, size, color: el('stColor').value || '#ffd60a' });
    el('stText').value = '';
  };
  el('stSize').addEventListener('input', () => {
    const o = state.overlays.find(x => x.id === state.sel && x.type === 'text');
    if (!o) return;
    o.size = clampSize(o, +el('stSize').value);
    state.dirty = true;
  });
  el('stText').addEventListener('keydown', e => { if (e.key === 'Enter') el('stAddText').click(); });

  const STICKERS = ['😀', '😂', '😍', '👍', '🙏', '❤️', '🔥', '⭐', '✅', '❗', '💯', '🎉', '👀', '⚠️', '📌', '🎯'];
  for (const s of STICKERS) {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = () => {
      if (!state.url) return toast(t('studioNoVideo'));
      addOverlay({ type: 'sticker', text: s, size: 22 });
    };
    el('stStickers').append(b);
  }

  // ---------- export ----------
  async function ensureAudio() {
    if (state.ac) { if (state.ac.state === 'suspended') await state.ac.resume(); return; }
    state.ac = new AudioContext();
    state.src = state.ac.createMediaElementSource(video);
    state.dest = state.ac.createMediaStreamDestination();
    state.src.connect(state.ac.destination); // preview sound
  }

  el('stExport').onclick = async () => {
    if (!state.url || state.exporting) return;
    if (!state.duration) return toast(t('studioNoVideo'));
    if (typeof rec !== 'undefined' && rec.active) return toast(t('err') + t('stopRecFirst'));
    const s = Math.max(0, Math.min(state.trim.s, state.trim.e - 0.2));
    const e = Math.min(state.duration, Math.max(state.trim.e, s + 0.2));
    if (!(e - s >= 0.2)) return;
    state.exporting = true; state.exp = { s, e };
    updateExportBtn();
    let opened = false, tracks = [];
    try {
      await ensureAudio();
      video.pause();
      if (Math.abs(video.currentTime - s) > 0.05) { video.currentTime = s; await once(video, 'seeked'); }
      state.dirty = true;
      const W = canvas.width, H = canvas.height, fps = +S.fps || 30;
      const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const bps = Math.min(30e6, Math.max(1e6, W * H * fps * 0.09));
      await api.recOpen({ ext, prefix: 'edited' });
      opened = true;
      state.src.disconnect(); state.src.connect(state.dest); // capture the sound, keep it off the speakers
      const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...state.dest.stream.getAudioTracks()]);
      tracks = stream.getTracks();
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps, audioBitsPerSecond: 160000 });
      let chain = Promise.resolve();
      recorder.ondataavailable = ev => { if (ev.data.size) chain = chain.then(async () => api.recChunk(await ev.data.arrayBuffer())); };
      const stopped = new Promise(r => { recorder.onstop = r; });
      recorder.start(1000);
      await video.play();
      await new Promise(resolve => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        video.addEventListener('ended', finish, { once: true });
        const tick = () => {
          if (video.currentTime >= e - 0.02 || video.ended) return finish();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      video.pause();
      recorder.stop();
      await stopped;
      await chain;
      const file = await api.recClose();
      opened = false;
      const filePath = file;
      if (filePath) {
        toast(t('exportDone') + ': ' + baseName(filePath), [
          [t('open'), () => api.openPath(filePath)],
          [t('showInFolder'), () => api.showInFolder(filePath)],
        ]);
        if (typeof page !== 'undefined' && page === 'history') loadHistory();
      }
    } catch (err) {
      toast(t('err') + (err && err.message || err));
    } finally {
      tracks.forEach(x => { try { x.stop(); } catch {} });
      if (opened) { try { await api.recClose(); } catch {} }
      try { state.src.disconnect(); state.src.connect(state.ac.destination); } catch {}
      state.exporting = false; state.exp = null;
      updateExportBtn(); updatePlayBtn(); state.dirty = true;
    }
  };

  // ---------- page lifecycle ----------
  window.addEventListener('page', e => {
    if (e.detail !== 'studio') { if (!video.paused) video.pause(); }
    else state.dirty = true;
  });
  window.addEventListener('beforeunload', () => { try { video.pause(); } catch {} });

  state.raf = requestAnimationFrame(loop);
  renderLayers();
  window.Studio = { openPath };
})();
