// app.js (updated to support NES, mGBA iframe, and GBA.js (gbajs) iframe)
// Strategy:
// - NES: existing jsnes path (runs in-page on canvas).
// - mGBA: send ROM to /mgba/player.html iframe (same-origin recommended).
// - GBA.js (gbajs): send ROM to /gbajs/player.html iframe (same-origin recommended).
//   If you prefer to use the archived public demo, open http://endrift.github.io/gbajs/ manually (cross-origin).
//
// Note: For automatic transfer of ROM ArrayBuffers use the same-origin iframe approach.

(() => {
  // DOM
  const fileInput = document.getElementById('rom-file');
  const dropZone = document.getElementById('drop-zone');
  const playBtn = document.getElementById('btn-play');
  const stopBtn = document.getElementById('btn-stop');
  const resetBtn = document.getElementById('btn-reset');
  const statusEl = document.getElementById('status');
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const emulatorSelect = document.getElementById('emulator-select');

  const mgbaFrameContainer = document.getElementById('mgba-frame-container');
  const mgbaFrame = document.getElementById('mgba-frame');

  const gbajsFrameContainer = document.getElementById('gbajs-frame-container');
  const gbajsFrameLocal = document.getElementById('gbajs-frame-local');

  // Image buffer for jsnes frames
  const imageData = ctx.getImageData(0, 0, 256, 240);

  // Audio
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioContext = null;
  const audioBuffer = [];

  // Emulator state
  let nes = null;
  let rafId = null;
  let running = false;

  // Helpers
  function setStatus(s) { statusEl.textContent = s; }

  function createNES() {
    audioBuffer.length = 0;
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }

    if (!audioContext) {
      try {
        audioContext = new AudioContextClass();
      } catch (e) {
        console.warn('WebAudio not supported:', e);
        audioContext = null;
      }
    }

    let scriptNode = null;
    if (audioContext) {
      const bufferSize = 4096;
      scriptNode = audioContext.createScriptProcessor(bufferSize, 0, 1);
      scriptNode.onaudioprocess = function (e) {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < output.length; i++) {
          output[i] = audioBuffer.length ? audioBuffer.shift() : 0;
        }
      };
      scriptNode.connect(audioContext.destination);
    }

    const nesInstance = new jsnes.NES({
      onFrame: function(frameBuffer) {
        for (let i = 0; i < frameBuffer.length; i++) {
          imageData.data[i] = frameBuffer[i];
        }
        ctx.putImageData(imageData, 0, 0);
      },
      onAudioSample: function (l, r) {
        const sample = (l + r) / 2;
        audioBuffer.push(Math.max(-1, Math.min(1, sample)));
      }
    });

    nesInstance._scriptNode = scriptNode;
    return nesInstance;
  }

  function startNESLoop() {
    if (!nes) return;
    if (running) return;
    running = true;
    setStatus('Running (NES)');
    function frame() {
      nes.frame();
      rafId = window.requestAnimationFrame(frame);
    }
    rafId = window.requestAnimationFrame(frame);
  }

  function stopNESLoop() {
    if (!running) return;
    running = false;
    setStatus('Stopped');
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function resetNES() {
    if (!nes) return;
    nes.reset();
    setStatus('Reset');
  }

  function loadNESArrayBuffer(arrayBuffer, filename) {
    nes = createNES();
    const romBytes = new Uint8Array(arrayBuffer);
    try {
      nes.loadROM(romBytes);
    } catch (err) {
      console.error('Failed to load ROM:', err);
      setStatus('Failed to load ROM (not a valid NES ROM?)');
      return;
    }
    setStatus('NES ROM loaded: ' + (filename || 'unknown'));
    playBtn.disabled = false;
    stopBtn.disabled = false;
    resetBtn.disabled = false;
    startNESLoop();
  }

  // ---------- iframe utilities for same-origin ROM transfer ----------
  function ensureMgbaIframeVisible(show) {
    mgbaFrameContainer.style.display = show ? 'block' : 'none';
    // hide other emulator frames and NES canvas
    gbajsFrameContainer.style.display = 'none';
    canvas.style.display = show ? 'none' : 'block';
  }

  function ensureGbajsIframeVisible(show) {
    gbajsFrameContainer.style.display = show ? 'block' : 'none';
    mgbaFrameContainer.style.display = 'none';
    canvas.style.display = show ? 'none' : 'block';
  }

  function postArrayBufferToIframe(iframeEl, message) {
    // Attempt transferable postMessage first
    try {
      iframeEl.contentWindow.postMessage(message, '*', [message.buffer].filter(Boolean));
    } catch (err) {
      // Fallback without transfer
      try {
        iframeEl.contentWindow.postMessage(message, '*');
      } catch (e) {
        console.error('Failed to postMessage to iframe', e);
        setStatus('Failed to send ROM to emulator iframe.');
      }
    }
  }

  // Send ROM to mGBA iframe
  function sendRomToMgba(buffer, filename) {
    ensureMgbaIframeVisible(true);
    const msg = { type: 'load-rom', filename, buffer };
    // Wait for iframe load if needed
    if (mgbaFrame.contentWindow && mgbaFrame.contentWindow.postMessage) {
      postArrayBufferToIframe(mgbaFrame, msg);
      setStatus('Sent ROM to mGBA iframe: ' + filename);
    } else {
      mgbaFrame.addEventListener('load', () => postArrayBufferToIframe(mgbaFrame, msg), { once: true });
    }
    playBtn.disabled = false;
    stopBtn.disabled = false;
    resetBtn.disabled = false;
  }

  // Send ROM to GBA.js iframe
  function sendRomToGbajs(buffer, filename) {
    ensureGbajsIframeVisible(true);
    const msg = { type: 'load-rom', filename, buffer };
    if (gbajsFrameLocal.contentWindow && gbajsFrameLocal.contentWindow.postMessage) {
      postArrayBufferToIframe(gbajsFrameLocal, msg);
      setStatus('Sent ROM to GBA.js iframe: ' + filename);
    } else {
      gbajsFrameLocal.addEventListener('load', () => postArrayBufferToIframe(gbajsFrameLocal, msg), { once: true });
    }
    playBtn.disabled = false;
    stopBtn.disabled = false;
    resetBtn.disabled = false;
  }

  // Listen for iframe messages (status/errors)
  window.addEventListener('message', (evt) => {
    const data = evt.data || {};
    if (data && data.type === 'status') {
      setStatus(data.text || 'status');
    }
    if (data && data.type === 'error') {
      setStatus('Error: ' + (data.text || ''));
    }
  });

  // ---------- Shared file handling ----------
  function handleFileObject(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const arrayBuffer = evt.target.result;
      const ext = (file.name || '').split('.').pop().toLowerCase();
      const selected = emulatorSelect.value;
      if (selected === 'nes' || ext === 'nes') {
        ensureMgbaIframeVisible(false);
        ensureGbajsIframeVisible(false);
        loadNESArrayBuffer(arrayBuffer, file.name);
      } else if (selected === 'mGBA') {
        stopNESLoop();
        sendRomToMgba(arrayBuffer, file.name);
      } else if (selected === 'gbajs') {
        stopNESLoop();
        sendRomToGbajs(arrayBuffer, file.name);
      } else {
        // default fallback
        loadNESArrayBuffer(arrayBuffer, file.name);
      }

      // Add to library visually (optional)
      try {
        const blobUrl = URL.createObjectURL(file);
        if (window.addLibraryItem) addLibraryItem(file.name, blobUrl, { type: ext });
      } catch (e) { /* ignore */ }
    };
    reader.readAsArrayBuffer(file);
  }

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    handleFileObject(f);
  });

  function preventDefault(e) { e.preventDefault(); e.stopPropagation(); }
  ['dragenter','dragover','dragleave','drop'].forEach(evt => {
    dropZone.addEventListener(evt, preventDefault, false);
  });
  dropZone.addEventListener('drop', (e) => {
    const f = (e.dataTransfer.files && e.dataTransfer.files[0]);
    if (!f) return;
    setStatus('Loading ' + f.name + ' ...');
    handleFileObject(f);
  });

  // Buttons
  playBtn.addEventListener('click', () => {
    const selected = emulatorSelect.value;
    if (selected === 'nes') {
      if (!nes) { setStatus('No NES ROM loaded'); return; }
      startNESLoop();
    } else if (selected === 'mGBA') {
      setStatus('mGBA iframe manages play state; use iframe controls if present.');
    } else if (selected === 'gbajs') {
      setStatus('GBA.js iframe manages play state; use iframe controls if present.');
    }
  });

  stopBtn.addEventListener('click', () => {
    const selected = emulatorSelect.value;
    if (selected === 'nes') {
      stopNESLoop();
    } else if (selected === 'mGBA') {
      try { mgbaFrame.contentWindow.postMessage({ type: 'stop' }, '*'); setStatus('Sent stop to mGBA'); } catch (e) { setStatus('Could not send stop to mGBA iframe.'); }
    } else if (selected === 'gbajs') {
      try { gbajsFrameLocal.contentWindow.postMessage({ type: 'stop' }, '*'); setStatus('Sent stop to GBA.js'); } catch (e) { setStatus('Could not send stop to GBA.js iframe.'); }
    }
  });

  resetBtn.addEventListener('click', () => {
    const selected = emulatorSelect.value;
    if (selected === 'nes') {
      resetNES();
    } else if (selected === 'mGBA') {
      try { mgbaFrame.contentWindow.postMessage({ type: 'reset' }, '*'); setStatus('Sent reset to mGBA'); } catch (e) { setStatus('Could not send reset to mGBA iframe.'); }
    } else if (selected === 'gbajs') {
      try { gbajsFrameLocal.contentWindow.postMessage({ type: 'reset' }, '*'); setStatus('Sent reset to GBA.js'); } catch (e) { setStatus('Could not send reset to GBA.js iframe.'); }
    }
  });

  // Emulator select: toggle UI
  emulatorSelect.addEventListener('change', (e) => {
    const selected = emulatorSelect.value;
    if (selected === 'mGBA') {
      ensureMgbaIframeVisible(true);
      setStatus('mGBA selected — ensure /mgba/player.html and mGBA build are hosted.');
    } else if (selected === 'gbajs') {
      ensureGbajsIframeVisible(true);
      setStatus('GBA.js selected — prefer hosting the archive under /gbajs/ for automatic ROM transfer.');
    } else {
      ensureMgbaIframeVisible(false);
      ensureGbajsIframeVisible(false);
      setStatus('NES selected.');
    }
  });

  // Basic keyboard mapping to NES controller1 (unchanged)
  const keyMapDown = {
    90: jsnes.Controller.BUTTON_A,      // Z
    88: jsnes.Controller.BUTTON_B,      // X
    13: jsnes.Controller.BUTTON_START,  // Enter
    16: jsnes.Controller.BUTTON_SELECT, // Shift
    37: jsnes.Controller.BUTTON_LEFT,   // Left arrow
    38: jsnes.Controller.BUTTON_UP,     // Up arrow
    39: jsnes.Controller.BUTTON_RIGHT,  // Right arrow
    40: jsnes.Controller.BUTTON_DOWN    // Down arrow
  };

  window.addEventListener('keydown', (e) => {
    if (!nes) return;
    const btn = keyMapDown[e.keyCode];
    if (btn !== undefined) {
      nes.buttonDown(1, btn);
      e.preventDefault();
    }
  }, false);

  window.addEventListener('keyup', (e) => {
    if (!nes) return;
    const btn = keyMapDown[e.keyCode];
    if (btn !== undefined) {
      nes.buttonUp(1, btn);
      e.preventDefault();
    }
  }, false);

  // Library-play listener (optional): load a library item by name (you'll need to store File objects if you want full restore)
  document.addEventListener('library-play', (e) => {
    const detail = e.detail || {};
    setStatus('Library play requested: ' + (detail.name || ''));
    // If you persist ROM bytes in IndexedDB, lookup and send to iframe here.
  });

  // Initialize UI state
  setStatus('Idle');
  ensureMgbaIframeVisible(false);
  ensureGbajsIframeVisible(false);
})();
