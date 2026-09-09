const ext = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
const $ = (id) => document.getElementById(id);
const FIELDS = ['overlayEnabled', 'rememberSpeed'];
const DEFAULTS = { overlayEnabled: true, rememberSpeed: true, defaultSpeed: 1 };

ext.storage.sync.get(DEFAULTS).then((s) => {
  for (const f of FIELDS) {
    const el = $(f);
    if (el) el.checked = !!s[f];
  }
  if ($('defaultSpeed')) $('defaultSpeed').value = String(s.defaultSpeed);
}).catch(() => {});

document.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', () => {
  ext.storage.sync.set({
    overlayEnabled: $('overlayEnabled') ? $('overlayEnabled').checked : true,
    rememberSpeed: $('rememberSpeed') ? $('rememberSpeed').checked : true,
    defaultSpeed: $('defaultSpeed') ? (parseFloat($('defaultSpeed').value) || 1) : 1
  }).catch(() => {});
}));

const shortcutsBtn = $('openShortcuts');
if (shortcutsBtn) {
  shortcutsBtn.addEventListener('click', async () => {
    try {
      const isFirefox = typeof InstallTrigger !== 'undefined' || navigator.userAgent.toLowerCase().includes('firefox');
      if (isFirefox) {
        alert('To configure shortcuts in Firefox:\n\n1. Open about:addons\n2. Click the gear icon (⚙) at the top right\n3. Select "Manage Extension Shortcuts"');
      } else {
        await ext.tabs.create({ url: 'chrome://extensions/shortcuts' });
      }
    } catch (e) { /* ignore */ }
  });
}
