// Placeholder stub for mgba.js — NOT the real mGBA build.
// Purpose: let your /mgba/player.html and the parent page run and test the postMessage + FS write flow
// while you obtain and install the official mGBA WebAssembly build (mgba.js + mgba.wasm).
//
// IMPORTANT:
// - This file is a *fake* shim that implements a tiny subset of the Emscripten Module API
//   (Module.FS_createDataFile, Module.ccall, and a fake exported symbol _run_from_path).
// - Replace this file with the *official* mGBA web build (mgba.js) when you have it.
// - The real mgba.js is an Emscripten-generated glue script that loads mgba.wasm and exposes FS and functions.

(function () {
  // If there's already a Module defined by a real build, don't overwrite it.
  if (window.Module && window.Module._isMgbaPlaceholder !== undefined) {
    // Already installed placeholder
    return;
  }

  // Create a minimal "Module" object with small FS emulation and ccall/_run hook.
  window.Module = window.Module || {};

  // Mark as placeholder so we don't conflict with a real build later.
  Module._isMgbaPlaceholder = true;

  // calledRun: player.html checks Module['calledRun'] === false to wait.
  // We'll set it true immediately so player.html doesn't hang waiting.
  Module['calledRun'] = true;

  // Simple in-memory "FS" for demo/testing only.
  // Real Emscripten FS_createDataFile writes into a virtual filesystem that native code can access.
  Module._romFS = {}; // map fullPath -> Uint8Array

  // Minimal FS_createDataFile(path, filename, data, canRead, canWrite)
  Module.FS_createDataFile = function (path, filename, data, canRead, canWrite) {
    try {
      var full = (path.endsWith('/') ? path.slice(0, -1) : path) + '/' + filename;
    } catch (e) {
      var full = path + '/' + filename;
    }

    var bytes;
    if (data instanceof Uint8Array) {
      bytes = data;
    } else if (data && data.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(data.buffer);
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (Array.isArray(data)) {
      bytes = new Uint8Array(data);
    } else {
      // try to coerce string
      try {
        bytes = new Uint8Array(String(data).split('').map(function (c) { return c.charCodeAt(0) & 0xFF; }));
      } catch (ee) {
        bytes = new Uint8Array(0);
      }
    }

    Module._romFS[full] = bytes;
    console.log('[mgba.js placeholder] FS_createDataFile ->', full, 'size=', bytes.length);
    return full;
  };

  // ccall(name, returnType, argTypes, args)
  // The real Emscripten ccall lets JS call compiled functions. We provide a stub that logs calls.
  Module.ccall = function (name, returnType, argTypes, args) {
    console.log('[mgba.js placeholder] ccall()', name, 'args=', args);
    // If the code tries to call a function that starts with "run" or "load", forward to our fake runner.
    if (name && typeof name === 'string' && name.toLowerCase().indexOf('run') !== -1) {
      var arg = (args && args.length) ? args[0] : undefined;
      // call the placeholder "export"
      if (typeof Module._run_from_path === 'function') {
        try {
          return Module._run_from_path(arg);
        } catch (err) {
          console.error('[mgba.js placeholder] error in _run_from_path:', err);
        }
      }
    }
    // stub return values (numbers -> 0, strings -> null)
    if (returnType === 'number') return 0;
    return null;
  };

  // A fake exported symbol that player.html's template may try to call (Module._run_from_path).
  Module._run_from_path = function (romPath) {
    console.log('[mgba.js placeholder] _run_from_path called with', romPath);
    // emulate some activity and notify parent that we "ran"
    try {
      parent.postMessage({ type: 'status', text: '(placeholder) mGBA run requested for ' + romPath }, '*');
    } catch (e) {
      console.warn('[mgba.js placeholder] cannot postMessage to parent:', e);
    }
    // Simulate successful run start
    return 0;
  };

  // Utility to let debugging UI inspect stored ROMs (only for dev).
  Module._listRomFiles = function () {
    return Object.keys(Module._romFS).map(function (k) { return { path: k, size: Module._romFS[k].length }; });
  };

  // Simulate runtime initialized (if user code checks for Module.onRuntimeInitialized)
  if (typeof Module.onRuntimeInitialized === 'function') {
    try {
      Module.onRuntimeInitialized();
    } catch (e) {
      console.warn('[mgba.js placeholder] error calling onRuntimeInitialized:', e);
    }
  }

  console.info('[mgba.js placeholder] placeholder module installed. THIS IS NOT THE REAL mGBA BUILD. Replace mgba.js with the official mGBA web build for full functionality.');
})();
