/* Video PiP Pro — content script
   - Hover any video: control bar with 3x speed, +/-5s skip and a custom seek bar
     (works on reels, shorts and long videos on X, Instagram, YouTube and all sites).
   - "PiP" button: custom Picture-in-Picture window (Document PiP API) with the same controls.
   - Floating up/down arrow buttons to scroll through posts and feeds (top frame only). */

(() => {
  'use strict';
  if (window.__vppLoaded || window.__vppInPip || window.name === 'vpp-image-popup') return;
  try {
    if (window.opener && window.opener.documentPictureInPicture && window.opener.documentPictureInPicture.window === window) return;
  } catch (e) {}
  if (document.title && (document.title.includes('Photo PiP') || document.title.includes('Video PiP Pro'))) return;
  window.__vppLoaded = true;

  /* ---------------- constants & helpers ---------------- */

  const ext = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  const IS_TOP = (() => { try { return window.self === window.top; } catch (e) { return false; } })();
  const Z_MAX = 2147483646;
  const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
             : m + ':' + String(ss).padStart(2, '0');
  };

  const rateLabel = (r) => (Math.round(r * 100) / 100) + '\u00d7';

  const ICONS = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.3v13.4L19.2 12z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M11.6 12 20 6.3v11.4zM3.2 12l8.4-5.7v11.4z"/></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path d="M12.4 12 4 6.3v11.4zM20.8 12l-8.4-5.7v11.4z"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M3.5 5.5h17v13h-17z"/><rect x="12" y="12" width="6.5" height="4.5" rx="1"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M16 3v2l-1 1v4l3 2v2h-5v5l-1 1-1-1v-5H6v-2l3-2V6L8 5V3h8z"/></svg>',
    restore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5"/><path d="M14 4h6v6"/><path d="M20 4l-9 9"/></svg>',
    up: '<svg viewBox="0 0 24 24"><polyline points="7 14.5 12 9.5 17 14.5"/></svg>',
    down: '<svg viewBox="0 0 24 24"><polyline points="7 9.5 12 14.5 17 9.5"/></svg>',
    volHigh: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    volLow: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',
    volMute: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    prevImg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    nextImg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    logo: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vpp-l-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#162968"/>
          <stop offset="50%" stop-color="#0b1329"/>
          <stop offset="100%" stop-color="#030612"/>
        </linearGradient>
        <linearGradient id="vpp-l-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d946ef"/>
          <stop offset="35%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
        <linearGradient id="vpp-l-track" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#a855f7"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
        <filter id="vpp-l-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.65"/>
        </filter>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="26" fill="url(#vpp-l-bg)" stroke="#38bdf8" stroke-width="2.5" stroke-opacity="0.85" filter="url(#vpp-l-shadow)"/>
      <rect x="22" y="37" width="16" height="5.5" rx="2.75" fill="url(#vpp-l-glow)"/>
      <rect x="27" y="45.5" width="11" height="5.5" rx="2.75" fill="url(#vpp-l-glow)"/>
      <path d="M43 28 C43 26.2 45 25.1 46.5 26.1 L72 41.5 C73.5 42.4 73.5 44.6 72 45.5 L46.5 60.9 C45 61.9 43 60.8 43 59 Z" fill="url(#vpp-l-glow)"/>
      <rect x="20" y="69.5" width="60" height="4.5" rx="2.25" fill="rgba(255,255,255,0.22)"/>
      <rect x="20" y="69.5" width="34" height="4.5" rx="2.25" fill="url(#vpp-l-track)"/>
      <circle cx="54" cy="71.75" r="5" fill="#ffffff" filter="url(#vpp-l-shadow)"/>
    </svg>`
  };

  /* ---------------- styles (adopted stylesheets, immune to page CSS/CSP) ---------------- */

  const SEEK_CSS = `
    .seekrow{display:flex;align-items:center;gap:10px}
    .seek{flex:1;height:18px;display:flex;align-items:center;cursor:pointer;touch-action:none;min-width:0}
    .track{position:relative;width:100%;height:5px;border-radius:99px;background:rgba(255,255,255,.22)}
    .seek:hover .track{height:7px}
    .buffer{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:99px;background:rgba(255,255,255,.25)}
    .played{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:99px;background:linear-gradient(90deg,#8f7bff,#4cc2ff)}
    .thumb{position:absolute;right:-6px;top:50%;transform:translateY(-50%) scale(0);width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.55);transition:transform .12s}
    .seek:hover .thumb,.seek.dragging .thumb{transform:translateY(-50%) scale(1)}
    .seek.live{opacity:.35;pointer-events:none}
    .time{font-size:11.5px;color:rgba(255,255,255,.85);font-variant-numeric:tabular-nums;white-space:nowrap;min-width:74px;text-align:right}
  `;

  const BTN_CSS = `
    .btnrow{display:flex;align-items:center;gap:5px}
    .btn{display:inline-flex;align-items:center;gap:4px;height:30px;min-width:30px;padding:0 7px;border-radius:9px;border:0;background:transparent;color:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;line-height:1;transition:background .12s,transform .08s}
    .btn:hover{background:rgba(255,255,255,.14)}
    .btn:active{transform:scale(.94)}
    .btn svg{width:17px;height:17px;fill:currentColor;display:block;flex:none}
    .btn.restore svg,.btn.pip svg{width:19px;height:19px}
    .btn.vol svg{width:18px;height:18px}
    .vol-wrap{display:inline-flex;align-items:center;position:relative;border-radius:9px;transition:background .12s}
    .vol-wrap:hover{background:rgba(255,255,255,.1)}
    .vol-slider{width:0;opacity:0;overflow:hidden;display:flex;align-items:center;height:30px;cursor:pointer;touch-action:none;transition:width .18s cubic-bezier(.4,0,.2,1),opacity .15s}
    .vol-wrap:hover .vol-slider,.vol-slider.dragging{width:56px;opacity:1;padding-right:8px}
    .vol-track{position:relative;width:100%;height:4px;border-radius:99px;background:rgba(255,255,255,.24);transition:height .12s}
    .vol-slider:hover .vol-track,.vol-slider.dragging .vol-track{height:6px}
    .vol-bar{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:99px;background:linear-gradient(90deg,#8f7bff,#4cc2ff)}
    .vol-thumb{position:absolute;right:-5px;top:50%;transform:translateY(-50%) scale(0);width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.5);transition:transform .12s}
    .vol-wrap:hover .vol-thumb,.vol-slider.dragging .vol-thumb{transform:translateY(-50%) scale(1)}
    .btn .lbl{font-size:10.5px;opacity:.85}
    .spacer{flex:1}
    .btn.speed{min-width:46px;justify-content:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}
    .btn.speed.hot{background:linear-gradient(90deg,#8f7bff,#4cc2ff);border-color:transparent;color:#0b0b12}
    .btn.caret{padding:0 4px;font-size:10px;opacity:.8}
    .btn.pin.on{color:#ffd76a;background:rgba(255,215,106,.12)}
    .menu{display:flex;flex-wrap:wrap;gap:5px}
    .menu.hidden{display:none}
    .chip{height:24px;padding:0 9px;border-radius:99px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;line-height:1}
    .chip:hover{background:rgba(255,255,255,.16)}
    .chip.on{background:linear-gradient(90deg,#8f7bff,#4cc2ff);border-color:transparent;color:#0b0b12}
  `;

  const PAGE_CSS = `
    :host{all:initial}
    *{box-sizing:border-box;margin:0;padding:0}
    .vpp-root{position:relative;display:inline-block;pointer-events:none}
    .vpp-trigger-icon{
      width:42px;height:42px;border-radius:12px;cursor:grab;pointer-events:auto;
      user-select:none;-webkit-user-select:none;touch-action:none;
      filter:drop-shadow(0 4px 14px rgba(0,0,0,.6));
      display:flex;align-items:center;justify-content:center;
      transition:transform .16s cubic-bezier(.34,1.56,.64,1),filter .16s ease;
    }
    .vpp-trigger-icon:hover{
      transform:scale(1.12);
      filter:drop-shadow(0 6px 20px rgba(56,189,248,.55));
    }
    .vpp-trigger-icon:active,.vpp-trigger-icon.dragging{
      cursor:grabbing;transform:scale(1.04);
    }
    .vpp-trigger-icon.hidden{display:none!important}

    .panel{
      position:relative;width:100%;display:flex;flex-direction:column;gap:8px;
      padding:10px 12px 11px;border-radius:14px;background:rgba(16,16,24,.88);
      backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px) saturate(1.5);
      border:1px solid rgba(255,255,255,.15);box-shadow:0 16px 48px rgba(0,0,0,.6),0 2px 10px rgba(0,0,0,.4);
      color:#fff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      user-select:none;-webkit-user-select:none;pointer-events:auto;cursor:grab;touch-action:none;
      transition:padding .15s,width .15s;
      animation:vpp-pop .18s cubic-bezier(.16,1,.3,1);
    }
    .panel.dragging{cursor:grabbing}
    .panel.hidden{display:none!important}

    @keyframes vpp-pop{
      0%{opacity:0;transform:scale(.92)}
      100%{opacity:1;transform:scale(1)}
    }

    .panel.is-image{flex-direction:row;align-items:center;justify-content:space-between;gap:10px;padding:6px 12px;border-radius:12px;width:auto}
    .panel.is-image .seekrow,.panel.is-image .btn.back,.panel.is-image .btn.play,.panel.is-image .btn.fwd,.panel.is-image .vol-wrap,.panel.is-image .btn.speed,.panel.is-image .btn.caret,.panel.is-image .menu{display:none}
    .panel.is-image .img-badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:rgba(255,255,255,.9);white-space:nowrap}
    .panel.is-image .btn.pip{background:linear-gradient(90deg,#8f7bff,#4cc2ff);color:#0b0b12;border-radius:8px;height:28px;padding:0 10px;gap:5px}
    .panel.is-image .btn.pip .pip-lbl{display:inline!important;font-weight:700;color:#0b0b12}
    .panel.is-image .btn.pip svg{fill:currentColor}

    .btn.logo-btn{padding:0 4px;margin-right:2px}
    .btn.logo-btn .mini-logo{width:22px;height:22px;display:flex;align-items:center;justify-content:center}
    .btn.collapse-btn svg{width:15px;height:15px;stroke:currentColor;fill:none}
    .btn.collapse-btn:hover{background:rgba(255,255,255,.2);color:#ff7676}
  ` + SEEK_CSS + BTN_CSS;


  const TOAST_CSS = `
    :host{all:initial}
    *{box-sizing:border-box;margin:0;padding:0}
    .toast{position:relative;background:rgba(16,16,24,.92);color:#fff;padding:9px 16px;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12.5px;font-weight:500;border:1px solid rgba(255,255,255,.16);box-shadow:0 8px 30px rgba(0,0,0,.45);opacity:0;transition:opacity .18s;white-space:nowrap}
    .toast.show{opacity:1}
  `;

  const PIP_CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:100%;height:100%;overflow:hidden;background:#000}
    body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#fff}
    .vpp-pip{position:relative;display:flex;width:100%;height:100%;background:#000;overflow:hidden}
    .vpp-pip video{display:block;width:100%;height:100%;flex:1 1 auto;min-height:0;object-fit:contain;background:#000}
    .vpp-pip img{display:block;flex:1 1 auto;min-height:0;width:100%;object-fit:contain;background:#000}
    .vpp-bar{
      position:absolute;left:0;right:0;bottom:0;
      display:flex;flex-direction:column;gap:8px;padding:12px 14px 14px;
      background:linear-gradient(0deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.68) 65%,transparent 100%);
      opacity:0;pointer-events:none;
      transform:translateY(12px);
      transition:opacity .25s ease,transform .25s ease;
      z-index:10;
    }
    .vpp-pip.show-controls .vpp-bar,
    .vpp-pip:hover .vpp-bar{
      opacity:1;pointer-events:auto;
      transform:translateY(0);
    }
    .vpp-pip:not(.show-controls){cursor:none}
    .vpp-pip.is-photo{cursor:default!important}
    .vpp-pip.is-photo img{cursor:default!important}
    .vpp-pip.is-photo .vpp-bar{
      position:absolute!important;left:0!important;right:0!important;bottom:0!important;
      display:flex!important;flex-direction:column!important;gap:8px!important;
      padding:10px 14px 12px!important;
      background:linear-gradient(0deg,rgba(0,0,0,.95) 0%,rgba(0,0,0,.82) 75%,transparent 100%)!important;
      opacity:1!important;pointer-events:auto!important;
      transform:none!important;
      transition:none!important;
      z-index:20!important;
    }
    .img-counter-pill{
      background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);
      border-radius:99px;padding:4px 12px;font-size:12px;font-weight:700;
      color:#fff;letter-spacing:0.5px;font-variant-numeric:tabular-nums;
      display:inline-flex;align-items:center;justify-content:center;
    }
    .btn.img-nav-btn{background:rgba(255,255,255,0.15);padding:0 12px;gap:6px;border-radius:8px;font-size:12.5px;height:30px}
    .btn.img-nav-btn:hover{background:rgba(255,255,255,0.28)}
    .btn.img-nav-btn svg{width:16px;height:16px;stroke:currentColor;fill:none}
  ` + SEEK_CSS + BTN_CSS;

  const SEEK_HTML = `
    <div class="seekrow">
      <div class="seek"><div class="track"><div class="buffer"></div><div class="played"><div class="thumb"></div></div></div></div>
      <div class="time">0:00 / 0:00</div>
    </div>`;
  const VOL_HTML = `
      <div class="vol-wrap">
        <button class="btn vol" title="Mute / Unmute (M)">${ICONS.volHigh}</button>
        <div class="vol-slider" title="Volume">
          <div class="vol-track">
            <div class="vol-bar"></div>
            <div class="vol-thumb"></div>
          </div>
        </div>
      </div>`;

  const PIP_BAR_HTML = `
    ${SEEK_HTML}
    <div class="btnrow">
      <button class="btn back" title="Back 5s (left arrow)">${ICONS.back}<span class="lbl">5s</span></button>
      <button class="btn play" title="Play / Pause (space)">${ICONS.pause}</button>
      <button class="btn fwd" title="Forward 5s (right arrow)"><span class="lbl">5s</span>${ICONS.fwd}</button>
      ${VOL_HTML}
      <div class="spacer"></div>
      <button class="btn speed" title="Speed (up/down arrows)">1×</button>
      <button class="btn restore" title="Return video to the page">${ICONS.restore}</button>
    </div>`;

  const PANEL_HTML = `
    ${SEEK_HTML}
    <div class="btnrow">
      <button class="btn logo-btn" title="Collapse to icon"><span class="mini-logo">${ICONS.logo}</span></button>
      <div class="img-badge" style="display:none"><span>📷 Photo</span></div>
      <button class="btn back" title="Back 5 seconds">${ICONS.back}<span class="lbl">5s</span></button>
      <button class="btn play" title="Play / Pause">${ICONS.pause}</button>
      <button class="btn fwd" title="Forward 5 seconds"><span class="lbl">5s</span>${ICONS.fwd}</button>
      ${VOL_HTML}
      <div class="spacer"></div>
      <button class="btn speed" title="Playback speed — click to cycle up to 3x">1×</button>
      <button class="btn caret" title="All speeds">▾</button>
      <button class="btn pip" title="Open custom PiP player (Alt+P)">${ICONS.pip}<span class="lbl pip-lbl" style="display:none">PiP</span></button>
      <button class="btn pin" title="Keep controls visible">${ICONS.pin}</button>
      <button class="btn collapse-btn" title="Minimize to icon">${ICONS.close}</button>
    </div>
    <div class="menu hidden"></div>`;

  /* ---------------- settings ---------------- */

  const DEFAULTS = { overlayEnabled: true, rememberSpeed: true, defaultSpeed: 1 };
  let settings = { ...DEFAULTS };
  let globalRate = 1;

  ext.storage.sync.get(DEFAULTS).then((s) => {
    settings = { ...DEFAULTS, ...s };
    globalRate = settings.rememberSpeed ? (Number(settings.defaultSpeed) || 1) : 1;
    if (activeVideo) applyRemembered(activeVideo);
  }).catch(() => {});

  ext.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const k of Object.keys(DEFAULTS)) if (k in ch) settings[k] = ch[k].newValue;
    if (!settings.rememberSpeed) globalRate = 1;
    else if ('defaultSpeed' in ch) globalRate = Number(settings.defaultSpeed) || 1;
    if (!settings.overlayEnabled) hidePanel();
    if (activeVideo) applyRemembered(activeVideo);
  });

  /* ---------------- shared speed logic ---------------- */

  function setSpeedOn(v, r) {
    try { v.playbackRate = r; } catch (e) { /* detached video */ }
    globalRate = settings.rememberSpeed ? (r > 1.001 ? r : 1) : 1;
  }

  function applyRemembered(v) {
    if (settings.rememberSpeed && globalRate > 1.001 && Math.abs((v.playbackRate || 1) - globalRate) > 0.01) {
      try { v.playbackRate = globalRate; } catch (e) { /* ignore */ }
    }
  }

  /* ---------------- video tracking ---------------- */

  const videos = new Set();

  function trackVideo(v) {
    if (videos.has(v)) return;
    videos.add(v);
    v.addEventListener('play', () => applyRemembered(v));
    v.addEventListener('ratechange', () => {
      // Sticky speed: re-apply when a site resets the rate (e.g. on new video / ad).
      if (!settings.rememberSpeed || globalRate <= 1.001) return;
      if (Math.abs((v.playbackRate || 1) - globalRate) > 0.01) {
        try { v.playbackRate = globalRate; } catch (e) { /* ignore */ }
      }
    });
    v.addEventListener('volumechange', () => {
      if (activeVideo === v) updateVolUi(volBtn, volBar, v);
    });
  }

  let scanQueued = false;
  function scan() {
    for (const v of document.querySelectorAll('video')) trackVideo(v);
    for (const v of [...videos]) if (!v.isConnected && !v.__vppInPip) videos.delete(v);
    if (!host.isConnected) {
      try { (document.body || document.documentElement).append(host); } catch (e) { /* ignore */ }
    }
  }

  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => { scanQueued = false; scan(); }, 250);
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------------- overlay control panel (shadow DOM) ---------------- */

  const host = document.createElement('div');
  host.id = 'vpp-overlay-host';
  host.style.cssText = 'position:fixed;left:0;top:0;width:auto;height:auto;display:none;z-index:' + Z_MAX + ';pointer-events:none;';
  const root = host.attachShadow({ mode: 'open' });
  const pageSheet = new CSSStyleSheet();
  pageSheet.replaceSync(PAGE_CSS);
  root.adoptedStyleSheets = [pageSheet];
  root.innerHTML = `
    <div class="vpp-root">
      <div class="vpp-trigger-icon" role="button" tabindex="0" title="Video PiP Pro (Click to open, Drag anywhere)">
        ${ICONS.logo}
      </div>
      <div class="panel hidden">
        ${PANEL_HTML}
      </div>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);
  const triggerIcon = $('.vpp-trigger-icon');
  const panel = $('.panel');
  const logoBtn = $('.btn.logo-btn');
  const collapseBtn = $('.btn.collapse-btn');
  const seek = $('.seek');
  const playedEl = $('.played');
  const bufferEl = $('.buffer');
  const timeEl = $('.time');
  const playBtn = $('.btn.play');
  const backBtn = $('.btn.back');
  const fwdBtn = $('.btn.fwd');
  const volBtn = $('.btn.vol');
  const volSlider = $('.vol-slider');
  const volBar = $('.vol-bar');
  const speedBtn = $('.btn.speed');
  const caretBtn = $('.btn.caret');
  const pipBtn = $('.btn.pip');
  const pinBtn = $('.btn.pin');
  const menuEl = $('.menu');
  const imgBadge = $('.img-badge');

  let isExpanded = false;
  let customPos = null;

  function saveCustomPos(pos) {
    customPos = pos || null;
    try {
      if (!pos) ext.storage.local.remove('vpp_custom_pos');
      else ext.storage.local.set({ vpp_custom_pos: pos });
    } catch (e) {}
  }

  function loadCustomPos() {
    try {
      ext.storage.local.get(['vpp_custom_pos']).then((res) => {
        if (res && res.vpp_custom_pos && typeof res.vpp_custom_pos.x === 'number') {
          customPos = res.vpp_custom_pos;
          if (host && host.style.display !== 'none') positionPanel();
        }
      }).catch(() => {});
    } catch (e) {}
  }
  loadCustomPos();

  function expandPanel() {
    if (activeImage) {
      openImagePip(activeImage);
      return;
    }
    isExpanded = true;
    triggerIcon.classList.add('hidden');
    panel.classList.remove('hidden');
    positionPanel();
    syncUi();
  }

  function collapsePanel() {
    isExpanded = false;
    panel.classList.add('hidden');
    triggerIcon.classList.remove('hidden');
    positionPanel();
  }

  let lastNonZeroVolume = 1;

  function updateVolUi(btn, bar, v) {
    if (!v || !btn) return;
    const muted = v.muted || v.volume === 0;
    const vol = muted ? 0 : v.volume;
    if (bar) bar.style.width = clamp(vol * 100, 0, 100) + '%';
    if (muted || vol === 0) {
      btn.innerHTML = ICONS.volMute;
      btn.title = 'Unmute (M)';
    } else if (vol <= 0.5) {
      btn.innerHTML = ICONS.volLow;
      btn.title = `Volume ${Math.round(vol * 100)}% (click to mute)`;
    } else {
      btn.innerHTML = ICONS.volHigh;
      btn.title = `Volume ${Math.round(vol * 100)}% (click to mute)`;
    }
  }

  function setVideoVolume(v, level) {
    if (!v) return;
    const clamped = clamp(level, 0, 1);
    try {
      v.volume = clamped;
      if (clamped > 0) {
        v.muted = false;
        lastNonZeroVolume = clamped;
      } else {
        v.muted = true;
      }
    } catch (e) { /* ignore */ }
  }

  function toggleMute(v) {
    if (!v) return;
    try {
      if (v.muted || v.volume === 0) {
        v.muted = false;
        const targetVol = lastNonZeroVolume > 0.05 ? lastNonZeroVolume : 1;
        v.volume = targetVol;
        toast('Volume ' + Math.round(targetVol * 100) + '%');
      } else {
        lastNonZeroVolume = v.volume;
        v.muted = true;
        toast('Muted');
      }
    } catch (e) { /* ignore */ }
  }

  for (const s of SPEEDS) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = rateLabel(s);
    b.dataset.rate = String(s);
    menuEl.append(b);
  }
  menuEl.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (c && activeVideo) setSpeedOn(activeVideo, parseFloat(c.dataset.rate) || 1);
  });

  let activeVideo = null;
  let activeImage = null;
  let pinned = false;
  let panelHover = false;
  let hideTimer = 0;
  let rafId = 0;
  let lastPaused = false;

  function showPanel() {
    if (!activeVideo && !activeImage) return;
    if (activeVideo && (activeVideo.__vppInPip || (pip && pip.video === activeVideo) || (document.pictureInPictureElement && activeVideo === document.pictureInPictureElement))) return;
    if (activeImage && pip) {
      if ((pip.placeholder && pip.placeholder.contains(activeImage)) || (pip.parent && pip.parent.contains(activeImage))) return;
    }
    host.style.display = 'block';
    if (activeImage) {
      const g = getPostGalleryInfo(activeImage);
      const total = Math.max(g.totalCount || 0, g.images.length);
      const isMulti = total > 1 || g.hasPageNav;
      triggerIcon.title = isMulti ? `Photo PiP (${total} photos \u2014 click to open in PiP, drag anywhere)` : 'Photo PiP (Click to open photo in PiP, Drag anywhere)';
      if (imgBadge) imgBadge.innerHTML = `<span>\ud83d\udcf7 ${isMulti ? total + ' Photos' : 'Photo'}</span>`;
      triggerIcon.classList.remove('hidden');
      panel.classList.add('hidden');
    } else if (isExpanded) {
      triggerIcon.classList.add('hidden');
      panel.classList.remove('hidden');
    } else {
      triggerIcon.title = 'Video PiP Pro (Click to open controls, Drag anywhere)';
      triggerIcon.classList.remove('hidden');
      panel.classList.add('hidden');
    }
    positionPanel();
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function hidePanel() {
    host.style.display = 'none';
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    menuEl.classList.add('hidden');
    activeImage = null;
    isExpanded = false;
    panel.classList.add('hidden');
    triggerIcon.classList.remove('hidden');
  }

  function tick() {
    rafId = 0;
    if (host.style.display === 'none' || (!activeVideo && !activeImage)) return;
    if (activeVideo && (activeVideo.__vppInPip || (pip && pip.video === activeVideo) || activeVideo === document.pictureInPictureElement)) {
      hidePanel();
      return;
    }
    if (activeImage && pip && pip.parent && pip.parent.contains(activeImage)) {
      hidePanel();
      return;
    }
    if (activeVideo && !activeVideo.isConnected && !activeVideo.__vppInPip) { hidePanel(); return; }
    if (activeImage && !activeImage.isConnected) { hidePanel(); return; }

    if (activeVideo) {
      // If the pinned panel's video scrolled away, follow the most visible video.
      const r = activeVideo.getBoundingClientRect();
      if (r.bottom < -40 || r.top > window.innerHeight + 40 || r.right < 0 || r.left > window.innerWidth) {
        const nv = pickScrollVideo();
        if (nv && nv !== activeVideo) { activeVideo = nv; lastPaused = nv.paused; }
      }
    }
    positionPanel();
    if (isExpanded) syncUi();
    rafId = requestAnimationFrame(tick);
  }

  function placeHost(W, H) {
    const x = clamp(customPos.x, 4, window.innerWidth - W - 4);
    const y = clamp(customPos.y, 4, window.innerHeight - H - 4);
    host.style.left = x + 'px';
    host.style.top = y + 'px';
    return true;
  }

  function positionPanel() {
    const target = activeVideo || activeImage;
    if (!target) return;
    const r = target.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) { host.style.opacity = '0'; return; }
    host.style.opacity = '1';

    if (!isExpanded) {
      const W = 42, H = 42;
      host.style.width = W + 'px';
      host.style.height = H + 'px';
      if (customPos) return void placeHost(W, H);
      let x = r.right - 54;
      let y = r.top + 12;
      x = clamp(x, 8, Math.max(8, window.innerWidth - W - 8));
      y = clamp(y, 8, Math.max(8, window.innerHeight - H - 8));
      host.style.left = x + 'px';
      host.style.top = y + 'px';
      return;
    }

    if (activeImage) {
      panel.classList.add('is-image');
      const W = Math.round(clamp(r.width * 0.55, 200, 300));
      const H = panel.offsetHeight || 42;
      host.style.width = W + 'px';
      host.style.height = 'auto';
      if (customPos) return void placeHost(W, H);
      let x = r.left + (r.width - W) / 2;
      let y = r.bottom - H - 16;
      if (y < r.top + 8) y = r.top + 14;
      x = clamp(x, 8, Math.max(8, window.innerWidth - W - 8));
      y = clamp(y, 8, Math.max(8, window.innerHeight - H - 8));
      host.style.left = x + 'px';
      host.style.top = y + 'px';
      return;
    }

    panel.classList.remove('is-image');
    const W = Math.round(clamp(r.width * 0.92, 280, 480));
    const H = panel.offsetHeight || 96;
    host.style.width = W + 'px';
    host.style.height = 'auto';
    if (customPos) return void placeHost(W, H);
    const lift = r.height >= window.innerHeight * 0.55 ? 86 : 18;
    let x = r.left + (r.width - W) / 2;
    let y = Math.min(r.bottom, window.innerHeight - 8) - H - lift;
    if (y < 8) y = Math.max(r.top, 8) + 12;
    x = clamp(x, 8, Math.max(8, window.innerWidth - W - 8));
    y = clamp(y, 8, Math.max(8, window.innerHeight - H - 8));
    host.style.left = x + 'px';
    host.style.top = y + 'px';
  }

  function syncUi() {
    if (activeImage) {
      panel.classList.add('is-image');
      const g = getPostGalleryInfo(activeImage);
      const total = Math.max(g.totalCount || 0, g.images.length);
      const isMulti = total > 1 || g.hasPageNav;
      if (imgBadge) {
        imgBadge.style.display = 'inline-flex';
        imgBadge.innerHTML = `<span>\ud83d\udcf7 ${isMulti ? total + ' Photos' : 'Photo'}</span>`;
      }
      return;
    }
    panel.classList.remove('is-image');
    if (imgBadge) imgBadge.style.display = 'none';

    const v = activeVideo;
    if (!v) return;
    const d = v.duration, t = v.currentTime || 0;
    if (isFinite(d) && d > 0) {
      playedEl.style.width = clamp((t / d) * 100, 0, 100) + '%';
      let buf = 0;
      try { buf = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0; } catch (e) { /* ignore */ }
      bufferEl.style.width = clamp((buf / d) * 100, 0, 100) + '%';
      timeEl.textContent = fmt(t) + ' / ' + fmt(d);
      seek.classList.remove('live');
    } else {
      playedEl.style.width = '0%';
      bufferEl.style.width = '0%';
      timeEl.textContent = 'LIVE';
      seek.classList.add('live');
    }
    const paused = v.paused;
    if (paused !== lastPaused) { lastPaused = paused; playBtn.innerHTML = paused ? ICONS.play : ICONS.pause; }
    const rate = v.playbackRate || 1;
    speedBtn.textContent = rateLabel(rate);
    speedBtn.classList.toggle('hot', rate > 1.001);
    for (const c of menuEl.querySelectorAll('.chip')) {
      c.classList.toggle('on', Math.abs(parseFloat(c.dataset.rate) - rate) < 0.01);
    }
    updateVolUi(volBtn, volBar, v);
  }

  function setActiveVideo(v) {
    if (activeVideo === v) return;
    activeImage = null;
    activeVideo = v;
    lastPaused = v.paused;
    applyRemembered(v);
  }

  function setActiveImage(img) {
    if (activeImage === img) return;
    activeVideo = null;
    activeImage = img;
  }

  /* hover detection: show the panel on the video or image post under the cursor */
  let mmRaf = 0, mmEvt = null;
  document.addEventListener('mousemove', (e) => {
    mmEvt = e;
    if (!mmRaf) mmRaf = requestAnimationFrame(processMove);
  }, { capture: true, passive: true });

  function processMove() {
    mmRaf = 0;
    const e = mmEvt;
    if (!e || !settings.overlayEnabled) return;
    const x = e.clientX, y = e.clientY;

    // Pointer over the panel itself: keep it open.
    if (host.style.display !== 'none') {
      const hr = host.getBoundingClientRect();
      if (x >= hr.left - 4 && x <= hr.right + 4 && y >= hr.top - 4 && y <= hr.bottom + 4) {
        clearTimeout(hideTimer); hideTimer = 0;
        return;
      }
    }

    // Do not show on video or placeholder currently playing in PiP
    if (pip && pip.video) {
      const ph = pip.placeholder;
      if (ph && ph.isConnected) {
        const pr = ph.getBoundingClientRect();
        if (x >= pr.left - 10 && x <= pr.right + 10 && y >= pr.top - 10 && y <= pr.bottom + 10) {
          return;
        }
      }
      if (pip.parent && pip.parent.isConnected) {
        const pr = pip.parent.getBoundingClientRect();
        if (pr.width > 20 && pr.height > 20 && x >= pr.left && x <= pr.right && y >= pr.top && y <= pr.bottom) {
          return;
        }
      }
    }
    if (document.pictureInPictureElement) {
      const nr = document.pictureInPictureElement.getBoundingClientRect();
      if (x >= nr.left && x <= nr.right && y >= nr.top && y <= nr.bottom) {
        return;
      }
    }

    // 1. Check video under cursor
    let bestV = null, bestVA = Infinity;
    for (const v of videos) {
      if (v.__vppInPip || (pip && pip.video === v) || v === document.pictureInPictureElement) continue;
      const r = v.getBoundingClientRect();
      if (r.width < 100 || r.height < 70) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const a = r.width * r.height;
        if (a < bestVA) { bestVA = a; bestV = v; }
      }
    }

    if (bestV) {
      clearTimeout(hideTimer); hideTimer = 0;
      setActiveVideo(bestV);
      showPanel();
      return;
    }

    // 2. Check image post under cursor (Instagram photo posts, feeds)
    const img = findImageAt(x, y);
    if (img) {
      clearTimeout(hideTimer); hideTimer = 0;
      setActiveImage(img);
      showPanel();
      return;
    }

    if (!panelHover && !pinned) {
      if (!hideTimer) hideTimer = setTimeout(() => { hideTimer = 0; hidePanel(); }, 1500);
    }
  }

  panel.addEventListener('pointerenter', () => { panelHover = true; clearTimeout(hideTimer); hideTimer = 0; });
  panel.addEventListener('pointerleave', () => { panelHover = false; if (!pinned) hideTimer = setTimeout(() => { hideTimer = 0; hidePanel(); }, 1800); });
  triggerIcon.addEventListener('pointerenter', () => { panelHover = true; clearTimeout(hideTimer); hideTimer = 0; });
  triggerIcon.addEventListener('pointerleave', () => { panelHover = false; if (!pinned && !isExpanded) hideTimer = setTimeout(() => { hideTimer = 0; hidePanel(); }, 1500); });

  /* free dragging anywhere on screen */
  function makeDraggable(el, onClick) {
    let isPointerDown = false;
    let startX = 0, startY = 0;
    let initHostX = 0, initHostY = 0;
    let hasMoved = false;

    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, .seek, .vol-slider, .chip, .menu')) return;
      if (e.button !== 0) return;

      isPointerDown = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = host.getBoundingClientRect();
      initHostX = rect.left;
      initHostY = rect.top;

      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    el.addEventListener('pointermove', (e) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!hasMoved && Math.hypot(dx, dy) > 4) {
        hasMoved = true;
        el.classList.add('dragging');
      }
      if (hasMoved) {
        const hostW = host.offsetWidth || el.offsetWidth || 42;
        const hostH = host.offsetHeight || el.offsetHeight || 42;
        const newX = clamp(initHostX + dx, 4, window.innerWidth - hostW - 4);
        const newY = clamp(initHostY + dy, 4, window.innerHeight - hostH - 4);
        customPos = { x: newX, y: newY };
        host.style.left = newX + 'px';
        host.style.top = newY + 'px';
      }
    });

    const finish = (e) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      el.classList.remove('dragging');
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (hasMoved) {
        saveCustomPos(customPos);
      } else if (onClick) {
        onClick(e);
      }
    };

    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  }

  makeDraggable(triggerIcon, () => {
    if (activeImage) openImagePip(activeImage);
    else expandPanel();
  });
  makeDraggable(panel, null);

  logoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    collapsePanel();
  });
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    collapsePanel();
  });

  triggerIcon.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    saveCustomPos(null);
    positionPanel();
    toast('Position reset to video');
  });
  panel.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, .seek, .vol-slider, .chip, .menu')) return;
    e.stopPropagation();
    saveCustomPos(null);
    positionPanel();
    toast('Position reset to video');
  });

  /* seek bar drag */
  let dragging = false;
  const ratioFromEvent = (e) => {
    const r = seek.getBoundingClientRect();
    return r.width ? clamp((e.clientX - r.left) / r.width, 0, 1) : 0;
  };
  seek.addEventListener('pointerdown', (e) => {
    const v = activeVideo;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    dragging = true;
    seek.classList.add('dragging');
    try { seek.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    try { v.currentTime = ratioFromEvent(e) * v.duration; } catch (err) { /* ignore */ }
  });
  seek.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const v = activeVideo;
    if (!v || !isFinite(v.duration)) return;
    try { v.currentTime = ratioFromEvent(e) * v.duration; } catch (err) { /* ignore */ }
  });
  const endDrag = () => { dragging = false; seek.classList.remove('dragging'); };
  seek.addEventListener('pointerup', endDrag);
  seek.addEventListener('pointercancel', endDrag);

  /* volume slider drag & mute click */
  let volDragging = false;
  const volRatioFromEvent = (e) => {
    const r = volSlider.getBoundingClientRect();
    return r.width ? clamp((e.clientX - r.left) / r.width, 0, 1) : 0;
  };
  volSlider.addEventListener('pointerdown', (e) => {
    const v = activeVideo;
    if (!v) return;
    volDragging = true;
    volSlider.classList.add('dragging');
    try { volSlider.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    setVideoVolume(v, volRatioFromEvent(e));
    updateVolUi(volBtn, volBar, v);
  });
  volSlider.addEventListener('pointermove', (e) => {
    if (!volDragging) return;
    const v = activeVideo;
    if (!v) return;
    setVideoVolume(v, volRatioFromEvent(e));
    updateVolUi(volBtn, volBar, v);
  });
  const endVolDrag = () => {
    if (!volDragging) return;
    volDragging = false;
    volSlider.classList.remove('dragging');
  };
  volSlider.addEventListener('pointerup', endVolDrag);
  volSlider.addEventListener('pointercancel', endVolDrag);

  volBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeVideo) {
      toggleMute(activeVideo);
      updateVolUi(volBtn, volBar, activeVideo);
    }
  });

  /* panel buttons */
  function skip(sec) {
    const v = activeVideo;
    if (!v) return;
    try {
      const d = v.duration;
      v.currentTime = isFinite(d) && d > 0 ? clamp(v.currentTime + sec, 0, d) : v.currentTime + sec;
    } catch (err) { /* ignore */ }
  }
  backBtn.addEventListener('click', () => skip(-5));
  fwdBtn.addEventListener('click', () => skip(5));
  playBtn.addEventListener('click', () => {
    const v = activeVideo;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  });
  speedBtn.addEventListener('click', () => {
    if (!activeVideo) return;
    cycleSpeedOn(activeVideo, 1);
  });
  caretBtn.addEventListener('click', () => menuEl.classList.toggle('hidden'));
  pipBtn.addEventListener('click', () => {
    if (activeVideo) openCustomPip(activeVideo);
    else if (activeImage) openImagePip(activeImage);
    else {
      const target = pickVisiblePostMedia();
      if (target?.type === 'video') openCustomPip(target.el);
      else if (target?.type === 'image') openImagePip(target.el);
    }
  });
  pinBtn.addEventListener('click', () => {
    pinned = !pinned;
    pinBtn.classList.toggle('on', pinned);
  });

  function cycleSpeedOn(v, dir) {
    const cur = v.playbackRate || 1;
    let i = SPEEDS.findIndex((s) => Math.abs(s - cur) < 0.01);
    if (i < 0) i = dir > 0 ? -1 : 0;
    i = (i + dir + SPEEDS.length) % SPEEDS.length;
    const next = SPEEDS[i] || 1;
    setSpeedOn(v, next);
    toast('Speed ' + rateLabel(next));
  }

  /* ---------------- custom Picture-in-Picture (Document PiP API) ---------------- */

  let pip = null;

  async function openCustomPip(video) {
    if (!video || video.__vppInPip) return;
    if (pip) { try { pip.win.focus(); } catch (e) { /* ignore */ } return; }
    // Instagram/FB/etc. set disablePictureInPicture to block PiP — clear it so
    // both custom (moved element keeps playing) and native fallback can work.
    try { video.disablePictureInPicture = false; video.removeAttribute('disablepictureinpicture'); } catch (e) { /* ignore */ }
    // If the video has no data yet (common in feeds), wait briefly for metadata
    // so the PiP window doesn't open black.
    try {
      if (video.readyState < 2 && !video.currentSrc && video.preload === 'none') video.load();
    } catch (e) { /* ignore */ }
    if (video.readyState < 1) {
      try {
        await new Promise((res) => {
          const done = () => { video.removeEventListener('loadedmetadata', done); res(); };
          video.addEventListener('loadedmetadata', done);
          setTimeout(done, 2500);
        });
      } catch (e) { /* ignore */ }
    }
    if (!('documentPictureInPicture' in window)) { nativePip(video); return; }

    let win;
    try {
      const vw = video.videoWidth || 640, vh = video.videoHeight || 360;
      const ar = (vw / vh) || 16 / 9;
      let w, h;
      if (ar >= 1) { h = 380; w = Math.round(h * ar); } else { w = 340; h = Math.round(w / ar); }
      win = await documentPictureInPicture.requestWindow({ width: clamp(w, 240, 1100), height: clamp(h, 240, 900) });
    } catch (err) {
      nativePip(video);
      return;
    }

    try {
      const doc = win.document;
      doc.title = 'Video PiP Pro';
      const sheet = new win.CSSStyleSheet();
      sheet.replaceSync(PIP_CSS);
      doc.adoptedStyleSheets = [sheet];

      const wrap = doc.createElement('div');
      wrap.className = 'vpp-pip';
      const bar = doc.createElement('div');
      bar.className = 'vpp-bar';
      bar.innerHTML = PIP_BAR_HTML;
      wrap.append(bar);
      doc.body.append(wrap);

      const wasPlaying = !video.paused;
      const parent = video.parentNode;
      const next = video.nextSibling;
      const prevStyle = video.getAttribute('style');
      const prevControls = video.controls;
      const placeholder = document.createElement('div');
      if (parent) parent.insertBefore(placeholder, video);

      wrap.prepend(video);
      video.style.cssText = 'display:block;width:100%;height:100%;flex:1 1 auto;min-height:0;object-fit:contain;background:#000;border:0;border-radius:0;margin:0;padding:0;position:static;transform:none;max-width:none;max-height:none;';
      video.controls = false;

      const ac = new AbortController();
      pip = { win, video, parent, next, placeholder, prevStyle, prevControls, ac, wasPlaying };
      video.__vppInPip = true;
      activeVideo = null;
      activeImage = null;
      hidePanel();

      // Sites like Instagram pause a video once it's detached from the feed
      // (IntersectionObserver / React re-render). Retry play a few times.
      if (wasPlaying) {
        const retry = (n) => {
          if (!pip || !video.isConnected) return;
          if (video.paused && n > 0) {
            video.play().catch(() => {});
            setTimeout(() => retry(n - 1), 700);
          }
        };
        setTimeout(() => retry(3), 250);
      }

      const q = (s) => bar.querySelector(s);
      const pSeek = q('.seek'), pPlayed = q('.played'), pBuf = q('.buffer'), pTime = q('.time');
      const pPlay = q('.btn.play'), pBack = q('.btn.back'), pFwd = q('.btn.fwd');
      const pVolBtn = q('.btn.vol'), pVolSlider = q('.vol-slider'), pVolBar = q('.vol-bar');
      const pSpeed = q('.btn.speed'), pRestore = q('.btn.restore');
      const SIG = { signal: ac.signal };

      const sync = () => {
        const d = video.duration, t = video.currentTime || 0;
        if (isFinite(d) && d > 0) {
          pPlayed.style.width = clamp((t / d) * 100, 0, 100) + '%';
          let b = 0;
          try { b = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0; } catch (e) { /* ignore */ }
          pBuf.style.width = clamp((b / d) * 100, 0, 100) + '%';
          pTime.textContent = fmt(t) + ' / ' + fmt(d);
          pSeek.classList.remove('live');
        } else {
          pTime.textContent = 'LIVE';
          pSeek.classList.add('live');
        }
        pPlay.innerHTML = video.paused ? ICONS.play : ICONS.pause;
        pSpeed.textContent = rateLabel(video.playbackRate || 1);
        pSpeed.classList.toggle('hot', (video.playbackRate || 1) > 1.001);
        updateVolUi(pVolBtn, pVolBar, video);
      };
      for (const ev of ['timeupdate', 'progress', 'durationchange', 'play', 'pause', 'ratechange', 'volumechange']) {
        video.addEventListener(ev, sync, SIG);
      }
      video.addEventListener('play', () => { if (pip) pip.wasPlaying = true; }, SIG);
      video.addEventListener('pause', () => { if (pip) pip.wasPlaying = false; }, SIG);
      sync();

      const seekBy = (s) => {
        try {
          if (isFinite(video.duration) && video.duration > 0) video.currentTime = clamp(video.currentTime + s, 0, video.duration);
          else video.currentTime = video.currentTime + s;
        } catch (e) { /* ignore */ }
      };
      pPlay.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); }, SIG);
      pBack.addEventListener('click', () => seekBy(-5), SIG);
      pFwd.addEventListener('click', () => seekBy(5), SIG);

      pVolBtn.addEventListener('click', () => {
        toggleMute(video);
        updateVolUi(pVolBtn, pVolBar, video);
      }, SIG);

      let pVd = false;
      const pVRatio = (e) => {
        const r = pVolSlider.getBoundingClientRect();
        return r.width ? clamp((e.clientX - r.left) / r.width, 0, 1) : 0;
      };
      pVolSlider.addEventListener('pointerdown', (e) => {
        pVd = true;
        pVolSlider.classList.add('dragging');
        try { pVolSlider.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        setVideoVolume(video, pVRatio(e));
        updateVolUi(pVolBtn, pVolBar, video);
      }, SIG);
      pVolSlider.addEventListener('pointermove', (e) => {
        if (!pVd) return;
        setVideoVolume(video, pVRatio(e));
        updateVolUi(pVolBtn, pVolBar, video);
      }, SIG);
      const stopPV = () => { pVd = false; pVolSlider.classList.remove('dragging'); showPipControls(); };
      pVolSlider.addEventListener('pointerup', stopPV, SIG);
      pVolSlider.addEventListener('pointercancel', stopPV, SIG);

      pSpeed.addEventListener('click', () => cycleSpeedOn(video, 1), SIG);
      pRestore.addEventListener('click', () => win.close(), SIG);

      let pd = false;
      const ratio = (e) => {
        const r = pSeek.getBoundingClientRect();
        return r.width ? clamp((e.clientX - r.left) / r.width, 0, 1) : 0;
      };
      pSeek.addEventListener('pointerdown', (e) => {
        if (!isFinite(video.duration) || video.duration <= 0) return;
        pd = true;
        pSeek.classList.add('dragging');
        try { pSeek.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        try { video.currentTime = ratio(e) * video.duration; } catch (err) { /* ignore */ }
      }, SIG);
      pSeek.addEventListener('pointermove', (e) => {
        if (!pd) return;
        try { video.currentTime = ratio(e) * video.duration; } catch (err) { /* ignore */ }
      }, SIG);
      const stopP = () => { pd = false; pSeek.classList.remove('dragging'); showPipControls(); };
      pSeek.addEventListener('pointerup', stopP, SIG);
      pSeek.addEventListener('pointercancel', stopP, SIG);

      /* auto-hide controls in PiP after 3s unless hovered */
      let pipHideTimer = 0;
      const showPipControls = () => {
        wrap.classList.add('show-controls');
        clearTimeout(pipHideTimer);
        pipHideTimer = setTimeout(() => {
          if (pd || pVd) return;
          wrap.classList.remove('show-controls');
        }, 3000);
      };

      wrap.addEventListener('pointermove', showPipControls, SIG);
      wrap.addEventListener('pointerenter', showPipControls, SIG);
      wrap.addEventListener('pointerdown', showPipControls, SIG);
      doc.addEventListener('keydown', showPipControls, SIG);
      wrap.addEventListener('pointerleave', () => {
        clearTimeout(pipHideTimer);
        if (!pd && !pVd) {
          pipHideTimer = setTimeout(() => wrap.classList.remove('show-controls'), 800);
        }
      }, SIG);

      showPipControls();

      doc.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(5); }
        else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (video.paused) video.play().catch(() => {}); else video.pause(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); cycleSpeedOn(video, 1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); cycleSpeedOn(video, -1); }
        else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(video); updateVolUi(pVolBtn, pVolBar, video); }
      }, SIG);

      win.addEventListener('pagehide', () => cleanupPip(), { once: true });
    } catch (err) {
      try { win.close(); } catch (e) { /* ignore */ }
      if (pip) cleanupPip();
      toast('Custom PiP failed \u2014 opening native PiP');
      nativePip(video);
    }
  }

  function cleanupPip() {
    const st = pip;
    pip = null;
    if (!st) return;
    if (st.image) { try { st.ac.abort(); } catch (e) { /* ignore */ } return; }
    const { video, parent, next, placeholder, prevStyle, prevControls, ac, wasPlaying } = st;
    try { ac.abort(); } catch (e) { /* ignore */ }
    try { video.__vppInPip = false; } catch (e) { /* ignore */ }
    try {
      if (prevStyle === null) video.removeAttribute('style');
      else video.setAttribute('style', prevStyle);
    } catch (e) { /* ignore */ }
    try { video.controls = prevControls; } catch (e) { /* ignore */ }
    try {
      // Placeholder sits exactly where the video was — most robust restore
      // even if the site re-rendered the original parent (React feeds).
      if (placeholder.isConnected) placeholder.replaceWith(video);
      else if (parent && video.parentNode !== parent) {
        if (next && next.parentNode === parent) parent.insertBefore(video, next);
        else parent.appendChild(video);
      }
    } catch (e) {
      try { (document.body || document.documentElement).append(video); } catch (e2) { /* ignore */ }
    }
    try { placeholder.remove(); } catch (e) { /* ignore */ }
    if (wasPlaying) { try { video.play().catch(() => {}); } catch (e) { /* ignore */ } }
    toast('Video returned to the page');
  }

  async function nativePip(video) {
    try {
      try { video.disablePictureInPicture = false; video.removeAttribute('disablepictureinpicture'); } catch (e) { /* ignore */ }
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
      video.__vppInPip = true;
      activeVideo = null;
      activeImage = null;
      hidePanel();
      await video.requestPictureInPicture();
      toast('Picture-in-Picture opened');
    } catch (e) {
      toast('PiP is not available for this video');
    }
  }

  /* ---------------- image PiP & post detection ---------------- */

  function getBestImageSrc(img) {
    if (!img) return '';
    // ponytail: currentSrc is the browser-resolved best srcset candidate
    let src = img.currentSrc || img.src || img.dataset?.src || img.dataset?.original || '';
    if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('blob:')) {
      try { src = new URL(src, location.href).href; } catch (e) { /* ignore */ }
    }
    return src;
  }

  function isValidPostImage(img) {
    if (!img || img.tagName !== 'IMG') return false;
    const r = img.getBoundingClientRect();
    if (r.width < 120 || r.height < 120) return false;
    const src = getBestImageSrc(img);
    if (!src || src.startsWith('data:image/svg')) return false;
    return true;
  }

  function findImageAt(x, y) {
    if (!document.elementsFromPoint) return null;
    const elements = document.elementsFromPoint(x, y);
    let fallback = null;
    for (const el of elements) {
      if (el.tagName === 'IMG' && isValidPostImage(el)) return el;
      if (!fallback) {
        const img = el.querySelector && el.querySelector('img');
        if (img && isValidPostImage(img)) {
          const ir = img.getBoundingClientRect();
          if (x >= ir.left && x <= ir.right && y >= ir.top && y <= ir.bottom) fallback = img;
        }
      }
    }
    return fallback;
  }

  /* Images can't use video PiP — show them in a Document PiP window instead (clone, page untouched). */
  function pickVisibleImage() {
    let best = null, bestA = 0;
    const collect = (root) => {
      for (const img of root.querySelectorAll('img')) {
        if (!isValidPostImage(img)) continue;
        const r = img.getBoundingClientRect();
        const iw = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
        const ih = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
        const a = iw * ih;
        if (a > bestA) { bestA = a; best = img; }
      }
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) collect(el.shadowRoot);
      }
    };
    collect(document);
    return best;
  }

  function pickVisiblePostMedia() {
    if (activeVideo && activeVideo.isConnected && !activeVideo.__vppInPip) {
      const r = activeVideo.getBoundingClientRect();
      if (r.bottom > 60 && r.top < window.innerHeight - 60) return { type: 'video', el: activeVideo };
    }
    if (activeImage && activeImage.isConnected) {
      const r = activeImage.getBoundingClientRect();
      if (r.bottom > 60 && r.top < window.innerHeight - 60) return { type: 'image', el: activeImage };
    }

    // Post closest to center of screen
    const centerY = window.innerHeight / 2;
    const articles = Array.from(document.querySelectorAll('article, [role="article"]'));
    let bestArticle = null, minCenterDist = Infinity;
    for (const art of articles) {
      const r = art.getBoundingClientRect();
      if (r.bottom < 50 || r.top > window.innerHeight - 50) continue;
      const dist = Math.abs((r.top + r.bottom) / 2 - centerY);
      if (dist < minCenterDist) {
        minCenterDist = dist;
        bestArticle = art;
      }
    }

    if (bestArticle) {
      const v = bestArticle.querySelector('video');
      if (v && v.isConnected && !v.__vppInPip) return { type: 'video', el: v };
      const img = bestArticle.querySelector('img');
      if (img && isValidPostImage(img)) return { type: 'image', el: img };
    }

    const sv = pickScrollVideo();
    if (sv) return { type: 'video', el: sv };

    const si = pickVisibleImage();
    if (si) return { type: 'image', el: si };

    return null;
  }

  function triggerElementClick(el) {
    if (!el) return;
    try {
      if (typeof el.focus === 'function') el.focus();
      el.click();
    } catch (e) { /* ignore */ }
  }

  function findNavButton(container, dir) {
    const root = container || document;
    const next = dir > 0;
    const btn = root.querySelector(next
      ? 'button[aria-label*="Next" i], [role="button"][aria-label*="Next" i], button[aria-label*="slide" i], button[aria-label*="forward" i]'
      : 'button[aria-label*="Previous" i], [role="button"][aria-label*="Previous" i], button[aria-label*="Prev" i], button[aria-label*="back" i]');
    if (btn) return btn;
    const svg = root.querySelector(next
      ? 'svg[aria-label*="Next" i], [aria-label="Next" i], svg[aria-label*="right" i]'
      : 'svg[aria-label*="Previous" i], [aria-label="Previous" i], svg[aria-label*="left" i]');
    if (svg) return svg.closest('button, [role="button"]') || svg;
    if (next) {
      const igBtn = root.querySelector('button._afxw, ._afxw');
      if (igBtn) return igBtn;
    }
    if (root !== document) return findNavButton(document, dir);
    return null;
  }

  function findNextButton(container) { return findNavButton(container, 1); }

  function findPrevButton(container) { return findNavButton(container, -1); }

  function getCarouselTotalCount(container) {
    if (!container) return 0;
    const dotContainers = container.querySelectorAll('div[role="tablist"], ._acnb');
    for (const dc of dotContainers) {
      const count = dc.children.length;
      if (count > 1 && count <= 25) return count;
    }
    const tabs = container.querySelectorAll('[role="tab"], ._acnb > div');
    if (tabs.length > 1 && tabs.length <= 25) return tabs.length;
    return 0;
  }

  function getActiveCarouselImage(container) {
    if (!container) return null;
    const imgs = Array.from(container.querySelectorAll('img')).filter(isValidPostImage);
    if (!imgs.length) return null;
    if (imgs.length === 1) return imgs[0];

    const cr = container.getBoundingClientRect();
    const centerX = cr.left + cr.width / 2;
    let best = null, minDist = Infinity;
    for (const im of imgs) {
      const ir = im.getBoundingClientRect();
      if (ir.width < 50 || ir.height < 50) continue;
      if (ir.right > cr.left - 20 && ir.left < cr.right + 20) {
        const dist = Math.abs((ir.left + ir.width / 2) - centerX);
        if (dist < minDist) {
          minDist = dist;
          best = im;
        }
      }
    }
    return best || imgs[0];
  }

  function findPostContainer(img) {
    if (!img) return null;
    const semantic = img.closest('article, [role="article"], [data-testid="tweet"], shreddit-post, [data-test-id="post-content"], .feed-shared-update-v2');
    if (semantic) return semantic;

    let cur = img.parentElement;
    let best = null;
    let depth = 0;
    while (cur && cur !== document.body && cur !== document.documentElement && depth < 25) {
      const nextBtn = findNextButton(cur);
      const prevBtn = findPrevButton(cur);
      const hasDots = cur.querySelector('div[role="tablist"], ._acnb, [aria-label*="dot" i]');
      const hasLike = cur.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"], svg[aria-label="Comment"], svg[aria-label="Share Post"]');

      if (nextBtn || prevBtn || hasDots) {
        best = cur;
      }
      if (hasLike || cur.tagName === 'ARTICLE' || cur.tagName === 'SECTION') {
        return cur;
      }
      cur = cur.parentElement;
      depth++;
    }
    return best || img.closest('div[style*="flex-direction: column"]') || img.parentElement?.parentElement?.parentElement || img.parentElement;
  }

  function getPostGalleryInfo(img) {
    if (!img) return { images: [], currentIndex: 0, container: null, hasPageNav: false, totalCount: 0 };

    const container = findPostContainer(img);
    const items = [];
    const seenSrcs = new Set();

    function collectFrom(c) {
      if (!c) return;
      const allImgs = Array.from(c.querySelectorAll('img'));
      for (const el of allImgs) {
        if (!isValidPostImage(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 80 || rect.height < 80) continue;
        const s = getBestImageSrc(el);
        if (!s || seenSrcs.has(s)) continue;
        seenSrcs.add(s);
        items.push({ src: s, alt: el.alt || 'Post photo', el });
      }
    }

    collectFrom(container);

    const currentSrc = getBestImageSrc(img);
    if (currentSrc && !seenSrcs.has(currentSrc)) {
      items.unshift({ src: currentSrc, alt: img.alt || 'Post photo', el: img });
      seenSrcs.add(currentSrc);
    }

    let currentIndex = items.findIndex(item => item.src === currentSrc || item.el === img);
    if (currentIndex < 0) currentIndex = 0;

    const nextBtn = findNextButton(container);
    const prevBtn = findPrevButton(container);
    const totalCount = getCarouselTotalCount(container) || items.length;
    const hasPageNav = Boolean(nextBtn || prevBtn || totalCount > 1 || items.length > 1);

    return { images: items, currentIndex, container, hasPageNav, totalCount };
  }

  async function openImagePip(img) {
    if (!img) return;
    if (pip) { try { pip.win.focus(); } catch (e) { /* ignore */ } return; }

    const gallery = getPostGalleryInfo(img);
    let images = [...gallery.images];
    let currentIndex = gallery.currentIndex;
    const container = gallery.container;
    let totalCount = gallery.totalCount || images.length;

    if (!images.length) {
      const src = getBestImageSrc(img);
      if (!src) { toast('No photo found on this post'); return; }
      images = [{ src, alt: img.alt || 'Post photo', el: img }];
      currentIndex = 0;
    }

    const curSrc = images[currentIndex]?.src || getBestImageSrc(img);

    if (!('documentPictureInPicture' in window)) {
      openImagePopup(images, currentIndex, container, totalCount);
      return;
    }

    let win;
    try {
      const targetEl = images[currentIndex]?.el || img;
      const vw = targetEl.naturalWidth || targetEl.width || 600, vh = targetEl.naturalHeight || targetEl.height || 600;
      const ar = (vw / vh) || 1;
      let w, h;
      if (ar >= 1) { h = 440; w = clamp(Math.round(h * ar), 300, 900); }
      else { w = 380; h = clamp(Math.round(w / ar), 300, 800); }
      win = await documentPictureInPicture.requestWindow({ width: clamp(w, 240, 1100), height: clamp(h, 240, 900) });
      win.__vppLoaded = true;
      win.__vppInPip = true;
    } catch (e) {
      openImagePopup(images, currentIndex, container, totalCount);
      return;
    }

    try {
      const doc = win.document;
      doc.title = 'Photo PiP — Video PiP Pro';
      const sheet = new win.CSSStyleSheet();
      sheet.replaceSync(PIP_CSS);
      doc.adoptedStyleSheets = [sheet];

      const wrap = doc.createElement('div');
      wrap.className = 'vpp-pip is-photo';

      const pic = doc.createElement('img');
      pic.referrerPolicy = 'no-referrer';
      pic.src = curSrc;
      pic.alt = images[currentIndex]?.alt || 'Post photo';
      pic.style.cssText = 'display:block;flex:1 1 auto;min-height:0;width:100%;height:100%;object-fit:contain;background:#000;transition:opacity .15s ease-out;';

      const bar = doc.createElement('div');
      bar.className = 'vpp-bar';
      bar.innerHTML = `
        <div class="btnrow">
          <span style="font-size:12px;font-weight:600;opacity:.85;padding-left:4px;display:inline-flex;align-items:center;gap:6px">
            📷 Photo PiP
          </span>
          <div class="spacer"></div>
          <div class="img-nav-controls" style="display:flex;align-items:center;gap:6px">
            <button class="btn img-nav-btn prev-btn" title="Return back (Left arrow)">${ICONS.prevImg}<span class="lbl">Back</span></button>
            <span class="img-counter-pill">1 / 1</span>
            <button class="btn img-nav-btn next-btn" title="Next photo (Right arrow)"><span class="lbl">Next</span>${ICONS.nextImg}</button>
          </div>
          <div class="spacer"></div>
          <button class="btn restore" title="Close">${ICONS.restore}<span class="lbl" style="margin-left:4px">Close</span></button>
        </div>
      `;

      wrap.append(pic, bar);
      doc.body.append(wrap);

      const ac = new AbortController();
      const SIG = { signal: ac.signal };
      pip = { win, image: true, ac };

      const counterEl = bar.querySelector('.img-counter-pill');
      const prevBtn = bar.querySelector('.btn.prev-btn');
      const nextBtn = bar.querySelector('.btn.next-btn');
      const navGroup = bar.querySelector('.img-nav-controls');
      const restoreBtn = bar.querySelector('.btn.restore');

      const updateDisplay = () => {
        const cur = images[currentIndex];
        if (!cur) return;
        pic.style.opacity = '0.7';
        pic.src = cur.src;
        pic.alt = cur.alt || 'Post photo';
        setTimeout(() => { pic.style.opacity = '1'; }, 40);

        const total = Math.max(totalCount, images.length, currentIndex + 1);
        navGroup.style.display = 'flex';
        counterEl.textContent = `${currentIndex + 1} / ${total}`;
      };

      pic.onerror = () => {
        try {
          const curEl = images[currentIndex]?.el || img;
          if (curEl && curEl.isConnected) {
            const canvas = document.createElement('canvas');
            canvas.width = curEl.naturalWidth || curEl.width || 600;
            canvas.height = curEl.naturalHeight || curEl.height || 600;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(curEl, 0, 0);
            pic.src = canvas.toDataURL('image/jpeg', 0.95);
          }
        } catch (err) { /* ignore */ }
      };

      const scanNewImages = () => {
        const targetContainer = container || img?.closest('article') || document;
        const found = Array.from(targetContainer.querySelectorAll('img'));
        let added = false;
        for (const el of found) {
          if (!isValidPostImage(el)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 80 || rect.height < 80) continue;
          const s = getBestImageSrc(el);
          if (s && !images.some(item => item.src === s)) {
            images.push({ src: s, alt: el.alt || 'Post photo', el });
            added = true;
          }
        }
        const newTotal = getCarouselTotalCount(targetContainer);
        if (newTotal > totalCount) totalCount = newTotal;
        return added;
      };

      const goNext = () => {
        const pageNextBtn = findNextButton(container);

        if (currentIndex < images.length - 1) {
          currentIndex++;
          if (pageNextBtn) {
            triggerElementClick(pageNextBtn);
          }
          updateDisplay();
          return;
        }

        if (pageNextBtn) {
          triggerElementClick(pageNextBtn);
          pic.style.opacity = '0.5';

          let attempts = 0;
          const prevLen = images.length;
          const checkMounted = () => {
            attempts++;
            scanNewImages();
            const activeEl = getActiveCarouselImage(container || img?.closest('article') || document);
            const activeSrc = getBestImageSrc(activeEl);
            if (activeSrc && !images.some(item => item.src === activeSrc)) {
              images.push({ src: activeSrc, alt: activeEl?.alt || 'Post photo', el: activeEl });
            }
            if (images.length > prevLen) {
              currentIndex = images.length - 1;
              updateDisplay();
            } else if (attempts < 6) {
              setTimeout(checkMounted, 100);
            } else {
              currentIndex = 0;
              updateDisplay();
            }
          };
          setTimeout(checkMounted, 80);
          return;
        }

        if (images.length > 1) {
          currentIndex = 0;
          updateDisplay();
        }
      };

      const goPrev = () => {
        const pagePrevBtn = findPrevButton(container);

        if (currentIndex > 0) {
          currentIndex--;
          if (pagePrevBtn) {
            triggerElementClick(pagePrevBtn);
          }
          updateDisplay();
          return;
        }

        if (pagePrevBtn) {
          triggerElementClick(pagePrevBtn);
          pic.style.opacity = '0.5';

          setTimeout(() => {
            scanNewImages();
            const activeEl = getActiveCarouselImage(container || img?.closest('article') || document);
            const activeSrc = getBestImageSrc(activeEl);
            const idx = images.findIndex(it => it.src === activeSrc);
            if (idx >= 0) currentIndex = idx;
            updateDisplay();
          }, 120);
          return;
        }

        if (images.length > 1) {
          currentIndex = images.length - 1;
          updateDisplay();
        }
      };

      prevBtn.addEventListener('click', (e) => { e.stopPropagation(); goPrev(); }, SIG);
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goNext(); }, SIG);
      restoreBtn.addEventListener('click', () => win.close(), SIG);

      doc.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          win.close();
        } else if (e.key === 'ArrowRight' || e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          goNext();
        } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
          e.preventDefault();
          goPrev();
        }
      }, SIG);

      win.addEventListener('pagehide', () => cleanupPip(), { once: true });

      updateDisplay();
    } catch (e) {
      try { win.close(); } catch (err) { /* ignore */ }
      toast('Photo PiP failed to open');
    }
  }

  function openImagePopup(imagesOrSrc, initialIndex = 0, container = null, totalCount = 0) {
    let images = [];
    if (typeof imagesOrSrc === 'string') {
      images = [{ src: imagesOrSrc, alt: 'Post photo' }];
    } else if (Array.isArray(imagesOrSrc)) {
      images = [...imagesOrSrc];
    }
    let currentIndex = typeof initialIndex === 'number' ? initialIndex : 0;
    if (currentIndex < 0 || currentIndex >= images.length) currentIndex = 0;

    const curImg = images[currentIndex]?.el;
    const vw = curImg?.naturalWidth || curImg?.width || 600;
    const vh = curImg?.naturalHeight || curImg?.height || 600;
    const ar = (vw / vh) || 1;
    let w, h;
    if (ar >= 1) { h = 440; w = clamp(Math.round(h * ar), 300, 900); }
    else { w = 380; h = clamp(Math.round(w / ar), 300, 800); }
    const left = window.screenX + (window.outerWidth - w) - 20;
    const top = window.screenY + 40;
    const popup = window.open('', 'vpp-image-popup', `width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) { toast('Photo PiP was blocked by the browser'); return; }

    try {
      popup.__vppLoaded = true;
      popup.__vppInPip = true;
      const doc = popup.document;
      doc.title = 'Photo PiP — Video PiP Pro';
      doc.body.style.cssText = 'margin:0;padding:0;background:#000;display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;position:relative;font-family:system-ui,-apple-system,sans-serif;color:#fff;user-select:none;';

      const pic = doc.createElement('img');
      pic.referrerPolicy = 'no-referrer';
      pic.src = images[currentIndex].src;
      pic.style.cssText = 'display:block;flex:1 1 auto;width:100%;height:100%;object-fit:contain;background:#000;transition:opacity .15s;';
      doc.body.append(pic);

      const navBar = doc.createElement('div');
      navBar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 16px;background:linear-gradient(0deg,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.65) 70%,transparent 100%);backdrop-filter:blur(8px);z-index:10;';

      const prevBtn = doc.createElement('button');
      prevBtn.innerHTML = '&#9664; Back';
      prevBtn.style.cssText = 'background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:12px;display:inline-flex;align-items:center;gap:6px;transition:background .15s;';
      prevBtn.onmouseover = () => { prevBtn.style.background = 'rgba(255,255,255,0.3)'; };
      prevBtn.onmouseout = () => { prevBtn.style.background = 'rgba(255,255,255,0.18)'; };

      const counter = doc.createElement('span');
      counter.style.cssText = 'font-size:12px;font-weight:700;color:#fff;padding:5px 12px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);border-radius:99px;font-variant-numeric:tabular-nums;';

      const nextBtn = doc.createElement('button');
      nextBtn.innerHTML = 'Next &#9654;';
      nextBtn.style.cssText = 'background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:12px;display:inline-flex;align-items:center;gap:6px;transition:background .15s;';
      nextBtn.onmouseover = () => { nextBtn.style.background = 'rgba(255,255,255,0.3)'; };
      nextBtn.onmouseout = () => { nextBtn.style.background = 'rgba(255,255,255,0.18)'; };

      const closeBtn = doc.createElement('button');
      closeBtn.innerHTML = '&times; Close';
      closeBtn.style.cssText = 'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:#ddd;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:600;font-size:12px;margin-left:8px;transition:background .15s;';
      closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(255,255,255,0.25)'; };
      closeBtn.onmouseout = () => { closeBtn.style.background = 'rgba(255,255,255,0.1)'; };
      closeBtn.addEventListener('click', () => popup.close());

      const updatePopup = () => {
        pic.src = images[currentIndex].src;
        const total = Math.max(totalCount, images.length);
        counter.textContent = `${currentIndex + 1} / ${total}`;
        navBar.style.display = (total > 1 || findNextButton(container) || findPrevButton(container)) ? 'flex' : 'none';
      };

      const goNext = () => {
        const pageNextBtn = findNextButton(container);
        if (currentIndex < images.length - 1) {
          currentIndex++;
          if (pageNextBtn) try { pageNextBtn.click(); } catch (e) {}
          updatePopup();
          return;
        }
        if (pageNextBtn) {
          try { pageNextBtn.click(); } catch (e) {}
          setTimeout(() => {
            const activeEl = getActiveCarouselImage(container);
            const s = getBestImageSrc(activeEl);
            if (s && !images.some(it => it.src === s)) {
              images.push({ src: s, alt: activeEl?.alt || 'Post photo', el: activeEl });
              currentIndex = images.length - 1;
            } else {
              currentIndex = 0;
            }
            updatePopup();
          }, 150);
          return;
        }
        if (images.length > 1) {
          currentIndex = (currentIndex + 1) % images.length;
          updatePopup();
        }
      };

      const goPrev = () => {
        const pagePrevBtn = findPrevButton(container);
        if (currentIndex > 0) {
          currentIndex--;
          if (pagePrevBtn) try { pagePrevBtn.click(); } catch (e) {}
          updatePopup();
          return;
        }
        if (pagePrevBtn) {
          try { pagePrevBtn.click(); } catch (e) {}
          setTimeout(() => {
            const activeEl = getActiveCarouselImage(container);
            const s = getBestImageSrc(activeEl);
            const idx = images.findIndex(it => it.src === s);
            if (idx >= 0) currentIndex = idx;
            updatePopup();
          }, 150);
          return;
        }
        if (images.length > 1) {
          currentIndex = images.length - 1;
          updatePopup();
        }
      };

      prevBtn.addEventListener('click', goPrev);
      nextBtn.addEventListener('click', goNext);
      navBar.append(prevBtn, counter, nextBtn, closeBtn);
      doc.body.append(navBar);

      doc.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') popup.close();
        else if (e.key === 'ArrowRight' || e.key === ' ' || e.code === 'Space') goNext();
        else if (e.key === 'ArrowLeft') goPrev();
      });

      updatePopup();
    } catch (e) { /* ignore */ }
  }

  /* ---------------- smart scrolling (shortcuts & commands) ---------------- */

  function scrollCandidates(v) {
    const list = [];
    let n = v;
    while (n) {
      let p = n.parentElement;
      if (!p) {
        const r = n.getRootNode && n.getRootNode();
        if (r && r instanceof ShadowRoot) p = r.host;
      }
      n = p;
      if (!n) break;
      if (n.nodeType === 1) list.push(n);
      if (n === document.body || n === document.documentElement) break;
    }
    return list;
  }

  function isScrollable(el) {
    if (el.scrollHeight <= el.clientHeight + 2 || el.clientHeight < 60) return false;
    const cs = getComputedStyle(el);
    return cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflow === 'auto' || cs.overflow === 'scroll';
  }

  function pickScrollVideo() {
    if (activeVideo && activeVideo.isConnected && !activeVideo.__vppInPip) return activeVideo;
    let best = null, bestA = 0;
    for (const v of videos) {
      if (v.__vppInPip) continue;
      const r = v.getBoundingClientRect();
      if (r.width < 120 || r.height < 80) continue;
      const iw = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
      const ih = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
      const a = iw * ih;
      if (a > bestA) { bestA = a; best = v; }
    }
    return best;
  }

  function findCurrentAndNextPost(dir) {
    let posts = Array.from(document.querySelectorAll('article, [role="article"]'));
    if (!posts.length && location.hostname.includes('instagram.com')) {
      posts = Array.from(document.querySelectorAll('main section > div, main div[style*="flex-direction: column"] > div'));
    }
    posts = posts.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 200 && r.height > 180;
    });
    if (!posts.length) return null;

    if (dir > 0) {
      for (const p of posts) {
        const r = p.getBoundingClientRect();
        if (r.top > 50) return p;
      }
    } else {
      let prev = null;
      for (const p of posts) {
        const r = p.getBoundingClientRect();
        if (r.top < -50) prev = p;
        else break;
      }
      return prev;
    }
    return null;
  }

  const NEXT_HINTS = ['ytd-shorts #navigation-button-down button', 'button[aria-label="Next"]', 'button[aria-label="Next reel"]'];
  const PREV_HINTS = ['ytd-shorts #navigation-button-up button', 'button[aria-label="Previous"]', 'button[aria-label="Previous reel"]'];

  function clickHint(sels) {
    for (const s of sels) {
      const b = document.querySelector(s);
      if (b) { b.click(); return true; }
    }
    return false;
  }

  function pressArrow(dir) {
    const key = dir > 0 ? 'ArrowDown' : 'ArrowUp';
    const opts = { key, code: key, keyCode: dir > 0 ? 40 : 38, which: dir > 0 ? 40 : 38, bubbles: true, cancelable: true };
    const t = document.activeElement || document.body;
    t.dispatchEvent(new KeyboardEvent('keydown', opts));
    t.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  async function smartScroll(dir) {
    if (!IS_TOP) return;

    // 1. Reel / Shorts specific buttons & arrow keys
    const isReelPage = location.pathname.includes('/reel') || location.pathname.includes('/shorts') || document.querySelector('ytd-shorts');
    if (isReelPage) {
      if (clickHint(dir > 0 ? NEXT_HINTS : PREV_HINTS)) return;
      pressArrow(dir);
      return;
    }

    // 2. Post-based smart scrolling (Instagram feed posts, articles)
    const targetPost = findCurrentAndNextPost(dir);
    if (targetPost) {
      targetPost.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // 3. Reel video / container candidates
    const v = pickScrollVideo();
    const cands = [];
    if (v) for (const el of scrollCandidates(v)) if (isScrollable(el)) cands.push(el);

    // 4. Any scrollable container on the page
    for (const el of document.querySelectorAll('main, [role="main"], div[style*="overflow-y"]')) {
      if (isScrollable(el) && !cands.includes(el)) cands.push(el);
    }
    cands.push(document.scrollingElement || document.documentElement || null);

    for (const c of cands) {
      const before = c ? c.scrollTop : window.scrollY;
      const h = c ? c.clientHeight : window.innerHeight;
      const total = c ? c.scrollHeight : document.documentElement.scrollHeight;
      if (total <= h + 2) continue;
      const amt = Math.round(h * 0.85) * dir;
      try {
        if (c) c.scrollBy({ top: amt, behavior: 'smooth' });
        else window.scrollBy({ top: amt, behavior: 'smooth' });
      } catch (e) {
        if (c) c.scrollTop = before + amt; else window.scrollTo(0, before + amt);
      }
      const moved = await new Promise((res) => setTimeout(() => {
        const after = c ? c.scrollTop : window.scrollY;
        res(Math.abs(after - before) > 2);
      }, 350));
      if (moved) return;
    }

    if (clickHint(dir > 0 ? NEXT_HINTS : PREV_HINTS)) return;
    pressArrow(dir);
  }

  /* ---------------- toast ---------------- */

  let toastHost = null, toastEl = null, toastTimer = 0;

  function toast(msg) {
    if (!IS_TOP) return;
    const par = document.body || document.documentElement;
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.id = 'vpp-toast-host';
      toastHost.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:' + (Z_MAX + 1) + ';pointer-events:none;display:flex;';
      const r = toastHost.attachShadow({ mode: 'open' });
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(TOAST_CSS);
      r.adoptedStyleSheets = [sheet];
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      r.append(toastEl);
      par.append(toastHost);
    }
    if (!toastHost.isConnected) par.append(toastHost);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }

  /* ---------------- fullscreen support & commands ---------------- */

  document.addEventListener('fullscreenchange', () => {
    const fs = document.fullscreenElement;
    const par = document.body || document.documentElement;
    try {
      if (fs && host.parentNode !== fs) fs.append(host);
      else if (!fs && host.parentNode !== par) par.append(host);
    } catch (e) { /* ignore */ }
  }, true);

  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'vpp-command') {
      handleCommand(msg.command);
      if (sendResponse) sendResponse({ ok: true });
    }
  });

  function handleCommand(cmd) {
    if (cmd === 'vpp-scroll-down' || cmd === 'vpp-scroll-up') {
      smartScroll(cmd === 'vpp-scroll-down' ? 1 : -1);
    } else if (cmd === 'vpp-speed-cycle') {
      const v = (activeVideo && activeVideo.isConnected) ? activeVideo : (IS_TOP ? pickScrollVideo() : null);
      if (v) { activeVideo = v; cycleSpeedOn(v, 1); }
    } else if (cmd === 'vpp-pip') {
      const target = (activeVideo && activeVideo.isConnected) ? { type: 'video', el: activeVideo }
                   : (activeImage && activeImage.isConnected) ? { type: 'image', el: activeImage }
                   : (IS_TOP ? pickVisiblePostMedia() : null);
      if (target?.type === 'video') openCustomPip(target.el);
      else if (target?.type === 'image') openImagePip(target.el);
      else toast('No video or photo found on this post');
    }
  }

  /* ---------------- init ---------------- */

  function init() {
    try { (document.body || document.documentElement).append(host); } catch (e) { /* ignore */ }
    scan();
  }

  if (document.body) init();
  else {
    const iv = setInterval(() => {
      if (document.body) { clearInterval(iv); init(); }
    }, 200);
  }
})();
