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

  // ---------- GBA (mGBA) integration via iframe ----------
  // We'll send the ROM via postMessage to /mgba/player.html iframe.
  // player.html should accept messages:
  //   { type: 'load-rom', filename: 'game.gba', buffer: ArrayBuffer }
  // and return status messages as { type: 'status', text: '...' }.
  function ensureMgbaIframeVisible(show) {
    mgbaFrameContainer.style.display = show ? 'block' : 'none';
    // hide the NES canvas when GBA is active
    canvas.style.display = show ? 'none' : 'block';
  }

  function sendRomToMgba(buffer, filename) {
    // First check whether the iframe is loadable (it may 404 if user hasn't put player.html in /mgba/)
    // We assume same-origin (hosted in your site). If it 404s, the iframe will show browser 404.
    ensureMgbaIframeVisible(true);

    function postWhenReady() {
      try {
        mgbaFrame.contentWindow.postMessage({ type: 'load-rom', filename, buffer }, '*', [buffer]);
        setStatus('Sent ROM to mGBA iframe: ' + filename);
      } catch (err) {
        // Some browsers may throw if transferable fails, fallback to non-transfer
        try {
          mgbaFrame.contentWindow.postMessage({ type: 'load-rom', filename, buffer }, '*');
          setStatus('Sent ROM to mGBA iframe (non-transfer): ' + filename);
        } catch (e) {
          console.error('Failed to post ROM to mGBA iframe:', e);
          setStatus('Failed to send ROM to mGBA iframe. See console for details.');
        }
      }
    }

    // If iframe is not yet loaded, wait for it.
    if (mgbaFrame.contentWindow && mgbaFrame.contentWindow.postMessage) {
      postWhenReady();
    } else {
      mgbaFrame.addEventListener('load', postWhenReady, { once: true });
    }
  }

  // Listen for status messages from iframe
  window.addEventListener('message', (evt) => {
    const data = evt.data || {};
    if (data && data.type === 'status') {
      setStatus('mGBA: ' + (data.text || ''));
    }
    if (data && data.type === 'error') {
      setStatus('mGBA error: ' + (data.text || ''));
    }
  });

  // ---------- Shared file handling (drag/drop + file input) ----------
  function handleFileObject(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const arrayBuffer = evt.target.result;
      const ext = (file.name || '').split('.').pop().toLowerCase();
      const selected = emulatorSelect.value;
      if (selected === 'nes' || ext === 'nes') {
        // NES path
        ensureMgbaIframeVisible(false);
        loadNESArrayBuffer(arrayBuffer, file.name);
      } else if (selected === 'gba' || ext === 'gba') {
        // GBA path
        // disable NES rendering so we don't draw to the NES canvas
        stopNESLoop();
        // show iframe and send ROM
        sendRomToMgba(arrayBuffer, file.name);
        playBtn.disabled = false;
        stopBtn.disabled = false;
        resetBtn.disabled = false;
      } else {
        // default: if user selected GBA, treat as GBA; else treat as NES
        if (selected === 'gba') {
          sendRomToMgba(arrayBuffer, file.name);
        } else {
          loadNESArrayBuffer(arrayBuffer, file.name);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    handleFileObject(f);
  });

  // Drag-and-drop
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
    } else {
      // For GBA, we do nothing special here; mGBA iframe handles play/pause itself.
      setStatus('For GBA, use the mGBA iframe controls (or player UI).');
    }
  });
  stopBtn.addEventListener('click', () => {
    const selected = emulatorSelect.value;
    if (selected === 'nes') {
      stopNESLoop();
    } else {
      // tell iframe to stop
      try {
        mgbaFrame.contentWindow.postMessage({ type: 'stop' }, '*');
        setStatus('Sent stop to mGBA');
      } catch (e) {
        setStatus('Could not send stop to mGBA iframe.');
      }
    }
  });
  resetBtn.addEventListener('click', () => {
    const selected = emulatorSelect.value;
    if (selected === 'nes') {
      resetNES();
    } else {
      try {
        mgbaFrame.contentWindow.postMessage({ type: 'reset' }, '*');
        setStatus('Sent reset to mGBA');
      } catch (e) {
        setStatus('Could not send reset to mGBA iframe.');
      }
    }
  });

  // Emulator select: toggle UI
  emulatorSelect.addEventListener('change', (e) => {
    const selected = emulatorSelect.value;
    if (selected === 'gba') {
      ensureMgbaIframeVisible(true);
      setStatus('GBA selected — ensure /mgba/player.html and mGBA build are hosted.');
    } else {
      ensureMgbaIframeVisible(false);
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

  // Initialize UI state
  setStatus('Idle');
  ensureMgbaIframeVisible(false);
})();
