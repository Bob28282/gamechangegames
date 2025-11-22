// Optional helper for adding/removing items from the CSS-only library grid.
// This file is intentionally minimal — the visual layout is done with CSS.
// Use it to append entries to the grid on ROM load (e.g., from app.js).
//
// Example usage from your loader code (e.g., in app.js when a ROM is loaded):
//   const url = URL.createObjectURL(file); // file is a File/Blob for ROM
//   addLibraryItem(file.name, url, { type: 'gba' });
//   // later, when unloading, you can call revokeLibraryUrl(url) to free object URL.
//
// NOTE: This file does not persist items across reloads. To keep a persistent library,
// you can store file metadata and optionally ArrayBuffer/base64 in IndexedDB and repopulate on load.

(function () {
  const grid = document.querySelector('.rom-grid');
  const empty = document.getElementById('library-empty');

  function updateEmptyState() {
    if (!grid) return;
    const count = grid.children.length;
    if (empty) empty.style.display = count ? 'none' : 'flex';
  }

  function makeItemElement(name, thumbUrl, meta) {
    const fig = document.createElement('figure');
    fig.className = 'rom-item';
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('data-filename', name);

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb';
    const img = document.createElement('img');
    img.src = thumbUrl || '';
    img.alt = name + ' thumbnail';
    thumbWrap.appendChild(img);

    const caption = document.createElement('figcaption');
    const title = document.createElement('strong');
    title.className = 'rom-title';
    title.textContent = name;
    const metaDiv = document.createElement('div');
    metaDiv.className = 'rom-meta';
    metaDiv.textContent = meta && meta.type ? meta.type : '';

    caption.appendChild(title);
    caption.appendChild(metaDiv);

    const actions = document.createElement('div');
    actions.className = 'rom-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'rom-play';
    playBtn.type = 'button';
    playBtn.title = 'Play';
    playBtn.textContent = '▶';
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Dispatch a custom event so the parent app can handle loading/playing
      const ev = new CustomEvent('library-play', { detail: { name, thumbUrl, meta }, bubbles: true });
      fig.dispatchEvent(ev);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'rom-remove';
    removeBtn.type = 'button';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fig.remove();
      revokeLibraryUrl(thumbUrl);
      updateEmptyState();
    });

    actions.appendChild(playBtn);
    actions.appendChild(removeBtn);

    fig.appendChild(thumbWrap);
    fig.appendChild(caption);
    fig.appendChild(actions);

    // Clicking the whole item should also trigger play
    fig.addEventListener('click', () => {
      const ev = new CustomEvent('library-play', { detail: { name, thumbUrl, meta }, bubbles: true });
      fig.dispatchEvent(ev);
    });

    return fig;
  }

  window.addLibraryItem = function (name, thumbUrl, meta) {
    if (!grid) return null;
    const item = makeItemElement(name, thumbUrl, meta);
    grid.appendChild(item);
    updateEmptyState();
    return item;
  };

  window.revokeLibraryUrl = function (url) {
    try {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    } catch (e) {}
  };

  // When library item is played, bubble an event the main app can listen to:
  // document.addEventListener('library-play', (e) => { console.log('play', e.detail); });
  updateEmptyState();
})();
