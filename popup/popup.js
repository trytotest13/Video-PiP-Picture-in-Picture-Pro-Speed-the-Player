const $ = (id) => document.getElementById(id);
const FIELDS = ['overlayEnabled', 'rememberSpeed'];
const DEFAULTS = { overlayEnabled: true, rememberSpeed: true, defaultSpeed: 1 };

chrome.storage.sync.get(DEFAULTS).then((s) => {
  for (const f of FIELDS) {
    const el = $(f);
    if (el) el.checked = !!s[f];
  }
  if ($('defaultSpeed')) $('defaultSpeed').value = String(s.defaultSpeed);
});

document.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', () => {
  chrome.storage.sync.set({
    overlayEnabled: $('overlayEnabled') ? $('overlayEnabled').checked : true,
    rememberSpeed: $('rememberSpeed') ? $('rememberSpeed').checked : true,
    defaultSpeed: $('defaultSpeed') ? (parseFloat($('defaultSpeed').value) || 1) : 1
  });
}));

$('openShortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
