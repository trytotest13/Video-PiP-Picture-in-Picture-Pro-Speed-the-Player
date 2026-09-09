// Video PiP Pro — background script
// Fills default settings on install and forwards keyboard shortcuts to the content script.

const ext = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
const DEFAULTS = { overlayEnabled: true, rememberSpeed: true, defaultSpeed: 1 };

ext.runtime.onInstalled.addListener(async () => {
  try {
    const current = await ext.storage.sync.get(DEFAULTS);
    await ext.storage.sync.set(current);
  } catch (e) { /* ignore */ }
});

ext.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      await ext.tabs.sendMessage(tab.id, { type: 'vpp-command', command });
    }
  } catch (e) {
    // Page without the content script (restricted internal pages, addon store, etc.)
  }
});
