(async () => {
  const { image, lang } = await api.regionInit();
  const c = document.getElementById('c'), g = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  document.getElementById('hint').textContent = I18N.dict[lang].regionHint;
  let bg = null;
  if (image) { bg = new Image(); bg.src = image; await bg.decode(); }
  let a = null, b = null;
  const rect = () => ({
    x: Math.round(Math.min(a.x, b.x)), y: Math.round(Math.min(a.y, b.y)),
    width: Math.round(Math.abs(a.x - b.x)), height: Math.round(Math.abs(a.y - b.y)),
  });
  function draw() {
    g.clearRect(0, 0, c.width, c.height);
    if (bg) g.drawImage(bg, 0, 0, c.width, c.height);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, c.width, c.height);
    if (!a) return;
    const r = rect();
    if (bg) {
      const kx = bg.width / c.width, ky = bg.height / c.height;
      g.drawImage(bg, r.x * kx, r.y * ky, r.width * kx, r.height * ky, r.x, r.y, r.width, r.height);
    } else {
      // near-zero alpha (not fully clear) so the transparent window keeps receiving the mouse
      g.clearRect(r.x, r.y, r.width, r.height); g.fillStyle = 'rgba(0,0,0,.01)'; g.fillRect(r.x, r.y, r.width, r.height);
    }
    g.strokeStyle = '#4f8cff'; g.lineWidth = 2; g.strokeRect(r.x + 0.5, r.y + 0.5, r.width, r.height);
    g.font = '13px "Segoe UI", sans-serif'; g.fillStyle = '#fff';
    g.fillText(`${r.width} × ${r.height}`, r.x + 4, r.y > 20 ? r.y - 6 : r.y + 18);
  }
  // the window is resized to the full display after load
  onresize = () => { c.width = innerWidth; c.height = innerHeight; draw(); };
  oncontextmenu = e => { e.preventDefault(); api.regionDone(null); }; // right-click cancels too
  onmousedown = e => { if (e.button !== 0) return; a = b = { x: e.clientX, y: e.clientY }; draw(); };
  onmousemove = e => { if (a && e.buttons) { b = { x: e.clientX, y: e.clientY }; draw(); } };
  onmouseup = () => {
    if (!a) return;
    const r = rect();
    if (r.width > 4 && r.height > 4) api.regionDone(r); else { a = b = null; draw(); }
  };
  onkeydown = e => { if (e.key === 'Escape') api.regionDone(null); };
  draw();
})();
