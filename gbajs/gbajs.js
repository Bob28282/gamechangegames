// gbajs.js placeholder shim
// PURPOSE: lightweight shim so /gbajs/player.html doesn't immediately fail while you add the real GBA.js build.
// Replace this file with the archived project's real build (from https://github.com/endrift/gbajs or the demo).
//
// This placeholder implements a minimal API surface many player pages probe for:
// - Module.FS_createDataFile (very small)
// - a minimal GBA.play/load-like stub that posts status back to parent

(function () {
  if (window.Module && window.Module._isGbajsPlaceholder) return;
  window.Module = window.Module || {};
  Module._isGbajsPlaceholder = true;
  Module['calledRun'] = true;

  Module._romFS = {};
  Module.FS_createDataFile = function (path, filename, data, canRead, canWrite) {
    var full = (path.endsWith('/') ? path.slice(0, -1) : path) + '/' + filename;
    var bytes;
    if (data instanceof Uint8Array) bytes = data;
    else if (data && data.buffer instanceof ArrayBuffer) bytes = new Uint8Array(data.buffer);
    else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (Array.isArray(data)) bytes = new Uint8Array(data);
    else bytes = new Uint8Array(0);
    Module._romFS[full] = bytes;
    console.log('[gbajs placeholder] FS_createDataFile ->', full, 'size=', bytes.length);
    return full;
  };

  // Expose a minimal global GBA object with a load/run API many player scripts attempt to call
  window.GBA = window.GBA || {};
  window.GBA.load = function (dataOrPath) {
    console.log('[gbajs placeholder] GBA.load called with', dataOrPath);
    try {
      parent.postMessage({ type: 'status', text: '(placeholder) GBA.load invoked' }, '*');
    } catch (e) {}
  };
  window.GBA.play = function (dataOrPath) {
    console.log('[gbajs placeholder] GBA.play called with', dataOrPath);
    try {
      parent.postMessage({ type: 'status', text: '(placeholder) GBA.play invoked' }, '*');
    } catch (e) {}
  };

  Module.ccall = Module.ccall || function (name, returnType, argTypes, args) {
    console.log('[gbajs placeholder] ccall', name, args);
    return 0;
  };

  console.info('[gbajs placeholder] lightweight placeholder installed. Replace gbajs.js with the real archived build for full emulation.');
})();
