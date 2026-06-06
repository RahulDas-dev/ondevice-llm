<div align="center">

<img src="public/favicon.svg" width="64" height="64" alt="ondevice-llm logo" />

# ondevice-llm

**A chat interface powered by Chrome's built-in Prompt API — running entirely on your device.**

No server. No API key. No data leaving your machine.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-rahuldas--dev.github.io-black?style=flat-square&logo=googlechrome)](https://rahuldas-dev.github.io/ondevice-llm/)

</div>

---

## What Is This?

`ondevice-llm` is a minimal, production-quality chat UI built on top of Chrome's experimental **[Prompt API](https://developer.chrome.com/docs/ai/built-in)** — a browser-native interface to **Gemini Nano**, Google's on-device language model.

Everything runs locally. Inference happens on your GPU/NPU. No cloud round-trips, no per-token billing, no privacy concerns.

---

## Features

| Feature | Details |
|---|---|
| **Text chat** | Typewriter streaming effect, copy & regenerate actions |
| **Image input** | Attach PNG / JPEG, ask questions about it |
| **Voice input** | Click to record, auto-submits audio to the model |
| **Download progress** | Live progress bar while Gemini Nano downloads |
| **Send / Pause** | Cancel generation mid-response |
| **Timestamps** | `HH:MM:SS` monospace timestamp on every message |
| **Input locking** | UI fully disabled until model is ready |
| **Dark mode** | Automatic via `prefers-color-scheme` |
| **Single file build** | Entire app inlines to one `index.html` via `vite-plugin-singlefile` |

---

## Demo

**[rahuldas-dev.github.io/ondevice-llm](https://rahuldas-dev.github.io/ondevice-llm/)**

> **Note:** Requires Chrome Canary with the Prompt API flag enabled. See [Setup](#setup) below.

---

## Setup

### 1. Enable the Prompt API in Chrome [ Optional Incase LLM is Crashing]

The API is experimental and requires Chrome Canary:

1. Download **[Chrome Canary](https://www.google.com/chrome/canary/)**
2. Go to `chrome://flags`
3. Search for **Prompt API for Gemini Nano** → set to **Enabled BypassPerfRequirement**
4. Go to `chrome://components` → find **Optimization Guide On Device Model** → **Check for update**
5. Restart Chrome

> The model is ~1–2 GB and downloads in the background. The UI shows a progress bar while it loads.

### 2. Run Locally

```bash
git clone https://github.com/RahulDas-dev/ondevice-llm.git
cd ondevice-llm
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome Canary.

### 3. Build for Production

```bash
npm run build
# Output: dist/index.html (single inlined file)
```

---

## How It Works

### Core API Usage

```js
// Create a session with multimodal support
const session = await LanguageModel.create({
  expectedInputs: [
    { type: 'text' },
    { type: 'image' },
    { type: 'audio' },
  ],
  expectedOutputs: [{ type: 'text' }],
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloading: ${(e.loaded / e.total * 100).toFixed(1)}%`)
    })
  }
})

// Text prompt
const text = await session.prompt('Explain quantum entanglement simply.')

// Image prompt
const blob = await fetch('photo.jpg').then(r => r.blob())
const description = await session.prompt([{
  role: 'user',
  content: [
    { type: 'text',  value: 'What is in this image?' },
    { type: 'image', value: blob },
  ]
}])

// Always destroy when done
session.destroy()
```

### Architecture

```
index.html          ← single entry point, SVG icons in <template>
src/
  main.js           ← all app logic (vanilla JS, no framework)
  style.css         ← CSS custom properties, dark mode, animations
vite.config.js      ← viteSingleFile plugin, base path for GitHub Pages
.github/
  workflows/
    deploy.yaml     ← build → gh-pages branch → GitHub Pages
```

No React. No Vue. No dependencies at runtime. Just the browser and the model.

---

## Known Limitations

The Prompt API is experimental. Here's what to expect:

**Session crashes** — Chrome's on-device model process can crash if multiple tabs use `LanguageModel` simultaneously. The app handles this with `session.destroy()` on `beforeunload` and auto-retry with exponential backoff (up to 3 attempts).

**Streaming instability** — `promptStreaming()` behaviour varies across Chrome builds (cumulative vs delta chunks, empty final tick). This app uses `prompt()` with a typewriter effect instead.

**Audio support** — `{ type: 'audio' }` is the newest addition to the API and may not work on all Chrome Canary builds. The app falls back to text-only gracefully.

**Hardware requirements** — Gemini Nano needs a capable GPU and ≥8 GB RAM. The model process will be killed on underpowered hardware.

---

## Tech Stack

| | |
|---|---|
| **Runtime** | Chrome Prompt API (Gemini Nano) |
| **Frontend** | Vanilla JS, CSS custom properties |
| **Build** | [Vite](https://vitejs.dev/) + [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) |
| **Deploy** | GitHub Actions → GitHub Pages |

---

## Deployment

Every push to `main` triggers the build pipeline:

```
git push main
  → npm ci + npm run build
  → dist/ pushed to gh-pages branch
  → GitHub Pages serves the live site
```

Workflow file: [`.github/workflows/deploy.yaml`](.github/workflows/deploy.yaml)

---

## Contributing

Issues and PRs are welcome. If you're experimenting with the Prompt API and hit something interesting (or broken), open an issue — happy to compare notes.

---

## License

MIT © [Rahul Das](https://github.com/RahulDas-dev)

---

<div align="center">

Built with the [Chrome Prompt API](https://developer.chrome.com/docs/ai/built-in) · Deployed on [GitHub Pages](https://pages.github.com/)

</div>