(function (root) {
  const dict = {
    ar: {
      appName: 'لقطة', navCapture: 'التقاط صورة', navRecord: 'تسجيل الشاشة', navCamera: 'الكاميرا فقط',
      navHistory: 'السجل', navSettings: 'الإعدادات', navAudio: 'تسجيل صوت فقط', openApp: 'فتح البرنامج',
      ctxMenu: 'إضافة "لقطة" لقائمة الزر الأيمن في سطح المكتب والمجلدات',
      ctxMenuHint: 'في ويندوز 11 تجدها تحت "عرض المزيد من الخيارات" (أو Shift + زر أيمن). إلغاء التحديد يحذفها.',
      audHint: 'يسجّل الميكروفون أو صوت الجهاز أو الاثنين معاً في ملف صوتي. الشريط يوضح مستوى الصوت أثناء التسجيل.',
      noAudioSrc: 'اختر ميكروفوناً أو فعّل صوت النظام أولاً', retry: 'إعادة المحاولة',
      camBusy: 'تعذّر تشغيل الكاميرا. قد تكون مستخدمة من برنامج آخر، أو أنها كاميرا افتراضية (مثل ByteCast) وبرنامجها غير مفتوح. وصّل كاميرا ويب أو أغلق البرنامج الآخر ثم أعد المحاولة.',
      camDenied: 'ويندوز منع الوصول للكاميرا. افتح الإعدادات > الخصوصية > الكاميرا واسمح لتطبيقات سطح المكتب.',
      fullScreen: 'الشاشة كاملة', region: 'تحديد منطقة', window: 'نافذة',
      capHint: 'تُحفظ كل لقطة تلقائياً وتُنسخ إلى الحافظة — وفتح المحرر مباشرة يمكن إيقافه من الإعدادات.',
      toolPen: 'قلم', toolRect: 'مستطيل', toolArrow: 'سهم', toolText: 'نص', toolHighlight: 'تظليل', toolBlur: 'تمويه',
      undo: 'تراجع', copy: 'نسخ', save: 'حفظ نسخة', textPlaceholder: 'اكتب النص ثم انقر على الصورة',
      source: 'المصدر', selected: 'المحدد:', sysAudio: 'تسجيل صوت النظام', mic: 'الميكروفون', none: 'بدون',
      webcamOverlay: 'إظهار الكاميرا فوق التسجيل', camera: 'الكاميرا', position: 'الموضع',
      posBR: 'أسفل اليمين', posBL: 'أسفل اليسار', posTR: 'أعلى اليمين', posTL: 'أعلى اليسار', size: 'الحجم',
      fps: 'الإطارات/ثانية', quality: 'الجودة', qHigh: 'عالية', qMed: 'متوسطة', qLow: 'منخفضة (حجم صغير)',
      start: 'ابدأ التسجيل', pause: 'إيقاف مؤقت', resume: 'استئناف', stop: 'إيقاف وحفظ',
      mirror: 'عكس الصورة (مرآة)', resolution: 'الدقة', micLive: 'يمكنك تغيير الميكروفون وموضع الكاميرا أثناء التسجيل.',
      chooseSource: 'اختر المصدر', cancel: 'إلغاء',
      historyEmpty: 'لا توجد ملفات بعد', open: 'فتح', showInFolder: 'إظهار في المجلد', del: 'حذف',
      edit: 'تعديل', copyPath: 'نسخ المسار', refresh: 'تحديث', openFolder: 'فتح مجلد الحفظ',
      language: 'اللغة', theme: 'المظهر', dark: 'داكن', light: 'فاتح', outDir: 'مجلد الحفظ', change: 'تغيير',
      countdown: 'العد التنازلي قبل التسجيل (ثوانٍ)', hideOnRecord: 'تصغير النافذة أثناء تسجيل الشاشة',
      autoCopy: 'نسخ اللقطة للحافظة تلقائياً', hotkeys: 'اختصارات لوحة المفاتيح',
      hkFull: 'لقطة للشاشة كاملة', hkRegion: 'لقطة لمنطقة', hkRec: 'بدء/إيقاف التسجيل', hkPause: 'إيقاف مؤقت/استئناف',
      privacy: 'كل شيء يبقى على جهازك: لا حساب، لا رفع، لا علامة مائية، لا حد للمدة.',
      saved: 'تم الحفظ', copied: 'تم النسخ', recSaved: 'تم حفظ التسجيل', trashed: 'نُقل إلى سلة المحذوفات',
      hotkeyFail: 'اختصار مستخدم من برنامج آخر ولم يُفعّل: ', err: 'خطأ: ',
      regionHint: 'اسحب لتحديد المنطقة — Esc أو زر الماوس الأيمن للإلغاء', recording: 'جارٍ التسجيل', paused: 'متوقف مؤقتاً',
      noCamera: 'لم يتم العثور على كاميرا',
      hkHint: 'انقر على الخانة ثم اضغط الاختصار الجديد. Esc للإلغاء، Backspace للتعطيل.',
      hkPress: 'اضغط الاختصار…', hkOff: 'معطّل', hkSaved: 'تم حفظ الاختصار', hkNeedMod: 'استخدم Ctrl أو Alt أو Shift مع الحرف',
      hkDup: 'هذا الاختصار مستخدم لأمر آخر', reset: 'استعادة الافتراضي', changeHotkeys: 'تغيير الاختصارات',
      quit: 'خروج', trayHint: 'لقطة لا يزال يعمل في الخلفية — افتحه من أيقونته بجوار الساعة.',
      openEditor: 'فتح المحرر بعد اللقطة (أطفئه للقطات الصامتة)', shotDelay: 'تأخير اللقطة (ثوانٍ)',
      closeToTray: 'الإغلاق يُخفي البرنامج للخلفية (الاختصارات تبقى تعمل)',
      startWithWindows: 'تشغيل لقطة تلقائياً مع ويندوز', srcAuto: 'تلقائي (الشاشة الرئيسية)',
      navStudio: 'استوديو الفيديو', videoEdit: 'تعديل الفيديو', openVideo: 'فتح فيديو',
      studioHint: 'افتح تسجيلاً من السجل أو من جهازك لتبدأ التعديل.', trim: 'قص المقطع',
      setStart: 'بداية من المؤشر', setEnd: 'نهاية من المؤشر',
      layers: 'الطبقات (نص وملصقات)', addText: 'إضافة نص', stickers: 'ملصقات',
      export: 'تصدير', exporting: 'جارٍ التصدير', exportDone: 'تم تصدير الفيديو',
      studioHint2: 'اسحب النص أو الملصق لتحريكه، واسحب أحد المربعات الزرقاء في الزوايا أو استخدم عجلة الماوس فوقه لتكبير/تصغير الحجم. كل طبقة لها وقت بداية ونهاية.',
      studioNoVideo: 'لا يوجد فيديو مفتوح', confirmDelete: 'تأكيد الحذف؟', stopRecFirst: 'أوقف التسجيل الحالي أولاً',
    },
    en: {
      appName: 'Laqta', navCapture: 'Screenshot', navRecord: 'Screen Record', navCamera: 'Camera Only',
      navHistory: 'History', navSettings: 'Settings', navAudio: 'Audio Only', openApp: 'Open app',
      ctxMenu: 'Add "Laqta" to the right-click menu on the desktop and in folders',
      ctxMenuHint: 'On Windows 11 it is under "Show more options" (or Shift + right-click). Unticking removes it.',
      audHint: 'Records the microphone, system sound, or both, to an audio file. The bar shows the sound level while recording.',
      noAudioSrc: 'Choose a microphone or turn on system audio first', retry: 'Try again',
      camBusy: 'The camera could not start. It may be in use by another app, or it is a virtual camera (such as ByteCast) whose app is not open. Plug in a webcam or close the other app, then try again.',
      camDenied: 'Windows blocked camera access. Open Settings > Privacy > Camera and allow desktop apps.',
      fullScreen: 'Full screen', region: 'Region', window: 'Window',
      capHint: 'Every capture is saved and copied to the clipboard — opening the editor right away can be turned off in Settings.',
      toolPen: 'Pen', toolRect: 'Rectangle', toolArrow: 'Arrow', toolText: 'Text', toolHighlight: 'Highlight', toolBlur: 'Blur',
      undo: 'Undo', copy: 'Copy', save: 'Save copy', textPlaceholder: 'Type text, then click the image',
      source: 'Source', selected: 'Selected:', sysAudio: 'Record system audio', mic: 'Microphone', none: 'None',
      webcamOverlay: 'Show webcam over recording', camera: 'Camera', position: 'Position',
      posBR: 'Bottom right', posBL: 'Bottom left', posTR: 'Top right', posTL: 'Top left', size: 'Size',
      fps: 'Frames/sec', quality: 'Quality', qHigh: 'High', qMed: 'Medium', qLow: 'Low (small file)',
      start: 'Start recording', pause: 'Pause', resume: 'Resume', stop: 'Stop & save',
      mirror: 'Mirror image', resolution: 'Resolution', micLive: 'You can change the microphone and webcam position while recording.',
      chooseSource: 'Choose a source', cancel: 'Cancel',
      historyEmpty: 'No files yet', open: 'Open', showInFolder: 'Show in folder', del: 'Delete',
      edit: 'Edit', copyPath: 'Copy path', refresh: 'Refresh', openFolder: 'Open output folder',
      language: 'Language', theme: 'Theme', dark: 'Dark', light: 'Light', outDir: 'Output folder', change: 'Change',
      countdown: 'Countdown before recording (seconds)', hideOnRecord: 'Minimize window while recording the screen',
      autoCopy: 'Copy screenshots to clipboard automatically', hotkeys: 'Keyboard shortcuts',
      hkFull: 'Full-screen screenshot', hkRegion: 'Region screenshot', hkRec: 'Start/stop recording', hkPause: 'Pause/resume',
      privacy: 'Everything stays on your PC: no account, no upload, no watermark, no time limit.',
      saved: 'Saved', copied: 'Copied', recSaved: 'Recording saved', trashed: 'Moved to Recycle Bin',
      hotkeyFail: 'Shortcut taken by another app, not enabled: ', err: 'Error: ',
      regionHint: 'Drag to select a region — Esc or right-click to cancel', recording: 'Recording', paused: 'Paused',
      noCamera: 'No camera found',
      hkHint: 'Click a box, then press the new shortcut. Esc cancels, Backspace disables.',
      hkPress: 'Press shortcut…', hkOff: 'Disabled', hkSaved: 'Shortcut saved', hkNeedMod: 'Use Ctrl, Alt or Shift with that key',
      hkDup: 'This shortcut is already used by another action', reset: 'Reset to default', changeHotkeys: 'Change shortcuts',
      quit: 'Quit', trayHint: 'Laqta is still running in the background — open it from the tray icon.',
      openEditor: 'Open the editor after a capture (turn off for silent shots)', shotDelay: 'Capture delay (seconds)',
      closeToTray: 'Closing hides to the background (shortcuts keep working)',
      startWithWindows: 'Start Laqta with Windows', srcAuto: 'Automatic (primary screen)',
      navStudio: 'Video Studio', videoEdit: 'Edit video', openVideo: 'Open video',
      studioHint: 'Open a recording from History or from your PC to start editing.', trim: 'Trim',
      setStart: 'Start at playhead', setEnd: 'End at playhead',
      layers: 'Layers (text & stickers)', addText: 'Add text', stickers: 'Stickers',
      export: 'Export', exporting: 'Exporting', exportDone: 'Video exported',
      studioHint2: 'Drag text or a sticker to move it. Drag a blue corner handle or use the mouse wheel over it to resize. Each layer has a start and an end time.',
      studioNoVideo: 'No video open', confirmDelete: 'Confirm delete?', stopRecFirst: 'Stop the current recording first',
    },
  };

  // KeyboardEvent -> Electron accelerator. Uses e.code so it works on an Arabic keyboard layout too.
  // Returns '' while only modifiers are held, null when a plain key needs a modifier.
  function codeToAccel(e) {
    const c = e.code;
    let key = null;
    if (/^Key[A-Z]$/.test(c)) key = c.slice(3);
    else if (/^Digit\d$/.test(c)) key = c.slice(5);
    else if (/^Numpad\d$/.test(c)) key = 'num' + c.slice(6);
    else if (/^F([1-9]|1\d|2[0-4])$/.test(c)) key = c;
    else key = ({ PrintScreen: 'PrintScreen', Space: 'Space', Enter: 'Enter', Tab: 'Tab', Insert: 'Insert', Delete: 'Delete',
      Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'Up', ArrowDown: 'Down',
      ArrowLeft: 'Left', ArrowRight: 'Right', Pause: 'Pause', ScrollLock: 'Scrolllock' })[c] || null;
    if (!key) return '';
    const mods = [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
    const standalone = /^(F\d+|PrintScreen|Pause|Scrolllock|Insert)$/.test(key);
    if (!mods.length && !standalone) return null; // a bare letter would hijack normal typing everywhere
    return [...mods, key].join('+');
  }
  const prettyAccel = a => a ? a.replace('CommandOrControl', 'Ctrl') : '';

  // Map a rect in display DIPs onto a video frame; even sizes keep H.264 encoders happy.
  function scaleRect(rect, displayWidth, videoW, videoH) {
    const s = videoW / displayWidth;
    const x = Math.max(0, Math.round(rect.x * s)), y = Math.max(0, Math.round(rect.y * s));
    const even = n => Math.max(2, Math.floor(n / 2) * 2);
    return { x, y, width: even(Math.min(rect.width * s, videoW - x)), height: even(Math.min(rect.height * s, videoH - y)) };
  }

  const api = { dict, scaleRect, codeToAccel, prettyAccel };
  if (typeof module !== 'undefined') module.exports = api; else root.I18N = api;
})(this);
