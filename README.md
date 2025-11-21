```markdown
# Netlify Game Host — Browser Emulator (NES + mGBA template)

This is a minimal static website that runs emulators in the browser and allows you to load ROM files from your computer (drag & drop or file input). It's designed to be deployed as a static site (for example, on Netlify).

Important: this project does NOT provide ROM files. Use only ROMs you legally own or public-domain/homebrew ROMs. Do not upload or distribute copyrighted ROMs you don't own.

## Features
- Client-side NES emulation with jsnes
- GBA integration template using mGBA WebAssembly (via same-origin iframe)
- Drag & drop or file input to load .nes or .gba ROM files
- Canvas-based video rendering and WebAudio playback (NES)
- Keyboard controls (Z/X = A/B, arrows = D-pad, Enter = Start, Shift = Select)
- No server-side storage — ROMs are read into browser memory only

## How GBA (mGBA) integration works
Because mGBA WebAssembly builds vary in their exported function names and startup method, this repository uses a small, safe pattern:

- The main site (index.html + app.js) will open an iframe at /mgba/player.html and send the ROM data to that iframe via postMessage.
- The iframe (mgba/player.html) is a template that expects you to host the mGBA web build files (mgba.js, mgba.wasm) inside the `mgba/` directory. The iframe contains a small loader and guidance to help you hook into the mGBA module's API (the exact C function names or exported JS wrappers may differ depending on how you built mGBA).
- This separation keeps your main site simple and avoids hardcoding internal API assumptions.

## Installing mGBA Web Build (what you need to do)
1. Download or build the mGBA web player artifacts (an Emscripten-generated mgba.js and mgba.wasm). If you are not building yourself, look for an official or community web build for mGBA. The code in `mgba/player.html` expects `mgba.js` and `mgba.wasm` to be placed in the `mgba/` folder at the site root.
2. Place `mgba.js`, `mgba.wasm`, and any supporting files inside `mgba/`.
3. Optionally modify `mgba/player.html` to call the correct exported function name from the mGBA Module (the file includes comments showing where to adapt calls).

## Files added/changed
- index.html — main UI: now has an emulator selector (NES or GBA).
- app.js — orchestrates NES and sends GBA ROMs to the mgba iframe using postMessage.
- mgba/player.html — template iframe page; you must host mGBA build files here and adapt one small function call if necessary.
- styles.css — unchanged.
- netlify.toml — unchanged static config.

## Deploy to Netlify
1. Create a new repository on GitHub and push these files.
2. Add the `mgba/` directory with `mgba.js` and `mgba.wasm`.
3. In Netlify, choose "New site from Git" and connect your repository, or drag the folder into "Deploy site".
4. The site is static; Netlify will serve `index.html` and `mgba/player.html`. No build step required.

## Legal / Security Notes
- This repository contains only emulator code and a loader UI. It purposefully does not include or fetch ROMs from external sources.
- You are responsible for ensuring you have legal rights to the ROMs you load.
- Do not use this to distribute copyrighted ROMs through your Netlify site.

## Next steps / Extending
- If you want, I can help you adapt `mgba/player.html` to the exact mGBA web build you have (tell me the exported function names or provide the mgba.js build) and make the iframe automatically call the correct entry points so the integration is seamless.
- Add save-state support (IndexedDB), a ROM library UI, additional emulator cores, or keyboard/gamepad configuration.

```
