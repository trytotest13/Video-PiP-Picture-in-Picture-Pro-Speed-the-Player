# Video PiP Pro - Speed the Player

I built this Chrome extension because I was tired of every social media site giving me zero control over video playback. No speed options on Instagram reels, no seek bar on Twitter videos, no way to skip ahead on short-form content — it drove me crazy. So I made something that works everywhere.

## What it does

**Video PiP Pro** adds a floating control bar on top of any video you hover over. Doesn't matter if you're on YouTube, Instagram, X (Twitter), Facebook, Reddit, TikTok, or some random site — if there's a video playing, you get full control.

Here's what you can do:

- **Speed up videos up to 3x** — cycle through 1x, 1.25x, 1.5x, 1.75x, 2x, 2.5x, and 3x with one click. There's also a "remember speed" option so it sticks across videos and reels even when the site tries to reset it.
- **Skip forward or back 5 seconds** — simple back and forward buttons that actually work on reels and shorts too.
- **Seek bar that works everywhere** — drag to seek on any video, even on reels and shorts where the site normally hides the progress bar. Shows buffered range and timestamps. Live streams show a "LIVE" badge instead.
- **Custom PiP player** — not Chrome's basic picture-in-picture. This one opens in its own window and keeps all your controls — speed, skip, seek bar, everything. When you close it, the video goes right back where it was on the page.
- **Photo PiP for image posts** — open any photo post in a floating PiP window. If the post has multiple images (like an Instagram carousel), you get Back and Next buttons with a counter (1/4, 2/4, etc.) to flip through them.
- **Pin the control bar** — if you want the controls to stay visible, just pin them.

### Feed navigation

There are small floating arrow buttons (▲ ▼) on the right side of the screen. Click them to scroll through posts. They're smart enough to snap to the next reel or short if you're in a video feed, and fall back to normal scrolling otherwise.

### Keyboard shortcuts

You can remap these at `chrome://extensions/shortcuts` if the defaults don't work for you.

| Shortcut | What it does |
|---|---|
| Alt + ↓ / Alt + ↑ | Scroll to next or previous post/reel |
| Alt + S | Cycle playback speed |
| Alt + P | Open PiP player |

When you're inside the PiP window, the arrow keys (← →) skip 5 seconds, Space pauses/plays, and up/down arrows change speed.

## How to install

1. Download or clone this folder
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and pick the `video-pip-pro` folder
5. Pin the extension from the puzzle-piece menu so you can access settings easily

You'll need **Chrome 116 or newer** for the custom PiP player to work. Older versions will fall back to Chrome's built-in PiP which is more limited.

## Settings

Click the extension icon to open the popup where you can toggle:

- On-video controls (the hover bar)
- Scroll buttons (the ▲ ▼ arrows)
- Remember speed across videos
- Set a default playback speed

## The draggable trigger icon

The extension shows a small floating icon near videos and photos. You can drag it anywhere on the page and it'll remember the position — even after you reload or switch posts. If you ever want to reset it back to the default spot, just double-click it.

## Good to know

- All the UI is rendered inside shadow DOM with adopted stylesheets, so it won't clash with any site's CSS or get blocked by content security policies.
- The PiP player works by moving the actual video element into the PiP window, so everything stays in sync with the site player. Some sites might briefly pause when it moves — the extension handles that and auto-resumes.
- DRM content (Netflix, Disney+, etc.) and Chrome internal pages aren't supported — that's a browser limitation, not something I can work around.
- The controls also work inside iframes and embedded players. Toasts and scroll buttons only show in the main frame to avoid duplicates.
- If you want to use this on local HTML files, go to `chrome://extensions`, find Video PiP Pro, and enable **Allow access to file URLs**.

## Project structure

```
video-pip-pro/
├── manifest.json        — extension config, permissions, shortcuts
├── background.js        — routes keyboard shortcuts to the active tab
├── content/content.js   — all the magic: control bar, seek logic, PiP player, scroll arrows, photo PiP
├── popup/               — settings popup UI
├── icons/               — extension icons (16, 32, 48, 128px)
└── devtools/            — icon generator and zip builder (dev tools, not part of the extension)
```

## License

Feel free to use, modify, and share. If you run into bugs or have ideas, open an issue or submit a PR.
