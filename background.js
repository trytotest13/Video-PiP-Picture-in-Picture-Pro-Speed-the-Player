// Video PiP Pro — service worker
// Fills default settings on install and forwards keyboard shortcuts to the content script.

const DEFAULTS = { overlayEnabled: true, rememberSpeed: true, defaultSpeed: 1 };

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set(current);
});

chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      await chrome.tabs.sendMessage(tab.id, { type: 'vpp-command', command });
    }
  } catch (e) {
    // Page without the content script (chrome:// pages, Web Store, etc.)
  }
});
