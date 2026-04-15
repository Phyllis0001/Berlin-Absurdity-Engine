# Berlin Absurdity Engine

A tactical city-monitoring web app set in Berlin. Built for an urban design studio at Bauhaus-Universität Weimar. The city is under constant surveillance — incidents spawn across the map, each one triggering an AI response unit that diagnoses the problem and proposes a solution that makes everything dramatically worse.

**Live site → [phyllis0001.github.io/Berlin-Absurdity-Engine](https://phyllis0001.github.io/Berlin-Absurdity-Engine/)**

---

## What it does

### 3D Berlin Map
An interactive dark-mode 3D map of Berlin powered by MapLibre GL JS and free OpenFreeMap tiles. Buildings are extruded, the camera can orbit and pan, and every active incident drops a live marker on the city.

### Incident System
Spawn two types of incidents from the control panel:

| Type | Examples |
|------|---------|
| **Real problems** | Car crash, fire, traffic jam, power outage, water main break |
| **Absurd problems** | Ghost, slow walker, bird threat, time anomaly, existential void |

Each incident has a severity level (LOW / MEDIUM / HIGH / CRITICAL) and a countdown before it auto-clears — or lingers indefinitely.

### AI Response Unit
Click any active incident marker on the map to open the **Crisis Response Unit** modal. It plays a calculating beep, then types out an AI-generated solution. The solutions are technically correct and entirely unhelpful. The footer always reads: `PROBLEM STATUS: NOT RESOLVED — EXAGGERATED`.

### Sensor Gaze Console
A real-time three-column system log styled like a tactical terminal:

- **TIMESTAMP** — time of event
- **RAW SENSOR INPUT** — real physics data (kinetic energy, vibration Hz, EM frequency, thermal readings)
- **AI ACTION** — the system's response (usually absurd)

Text types out character-by-character at ~91 chars/sec. Colour-coded by severity: matrix green (normal), amber (warning), red glow (critical). Weather conditions inject matching sensor events (lightning discharge, hail protocol, fog visibility, etc.).

### Weather & Seasons
The **ENV_MODULATOR** dial cycles through weather states and seasons. Each state changes the map atmosphere, sky, and fog — and injects weather-specific events into the Sensor Gaze feed.

| Weather | Effect |
|---------|--------|
| Rain | Grey fog overlay, rain particle effect |
| Storm | Dark sky, lightning flashes |
| Heatwave | Orange haze, heat shimmer |
| Snow | White overlay, snowfall particles |
| Fog | Heavy fog layer, reduced visibility |
| Hail | Rapid particle bursts |
| Sunny | Bright sky, clear atmosphere |

### Zone Status
Five tactical sectors across Berlin (MITTE, KREUZBERG, PRENZLAUER BERG, NEUKÖLLN, CHARLOTTENBURG), each with a live threat level that updates as incidents spawn nearby.

### Bio Supervisor (Webcam)
An optional surveillance panel in the bottom-right corner:

- **720p feed** with a night-vision CSS filter (green phosphor tones)
- **face-api.js** expression detection (Happy / Sad / Surprised) running at 3fps
- **Bounding box overlay** — brackets, crosshair, and dashed ellipse drawn over detected faces
- **PSYCH·PROFILE panel** — live expression probability bars, Humanity %, Compliance %, Blink Rate, and Risk Class
- **Bio-alert trigger** — fast motion or expression anomaly flashes the map red and draws a containment laser from the webcam to the map centre
- **TTS narration** — a cold robotic bureaucrat voice reads out the detected state
- **Sound effects** — distinct audio cues for happy / sad / surprised detection
- **Camera selector** — switch between the built-in laptop camera and any connected USB camera

### Sound System
A toggle button (`SND: ON / OFF`) controls all audio:
- AI modal beep on "calculating" phase
- TTS narration of every AI solution
- Webcam expression sound effects

---

## Setup

You need [Node.js](https://nodejs.org) v18 or newer.

```bash
# 1. Clone the repo
git clone https://github.com/Phyllis0001/Berlin-Absurdity-Engine.git
cd Berlin-Absurdity-Engine

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Changes you make to the source files update instantly (hot reload).

```bash
# Build for production
npm run build
```

---

## Deploying to GitHub Pages

Deployment is fully automatic. Every push to `main` triggers the GitHub Actions workflow in `.github/workflows/deploy.yml`, which builds the app and publishes it to GitHub Pages.

**One-time setup (already done for this repo):**
1. Go to **Settings → Pages → Source** and select **GitHub Actions**
2. The `VITE_BASE` in the workflow is already set to `/Berlin-Absurdity-Engine/`

After that: push → wait ~60 seconds → site updates.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Vite](https://vitejs.dev) + [React 18](https://react.dev) | Build tool and UI framework |
| [MapLibre GL JS](https://maplibre.org) | 3D map rendering |
| [OpenFreeMap](https://openfreemap.org) | Free map tiles (no API key) |
| [face-api.js](https://github.com/justadudewhohacks/face-api.js) | In-browser face + expression detection |
| Web Audio API | Sound effects and beeps |
| Web Speech API | TTS narration |
| [react-icons](https://react-icons.github.io) | Icon set |
| GitHub Actions | Automatic deployment |

---

## Project Structure

```
src/
├── components/
│   ├── MapComponent.jsx       # 3D map, markers, bio-alert overlay
│   ├── WebcamFeed.jsx         # Surveillance panel with face detection
│   ├── LogicFeed.jsx          # Sensor Gaze console (typewriter feed)
│   ├── AISolutionModal.jsx    # AI response modal with sound
│   ├── ProblemPanel.jsx       # Incident spawn controls
│   ├── WeatherModulator.jsx   # ENV_MODULATOR dial
│   ├── WeatherEffect.jsx      # Visual weather overlays
│   ├── WarningOverlay.jsx     # Red alert flash overlay
│   ├── MapMarkersEffect.jsx   # Incident markers on map
│   └── CoordTracker.jsx       # Live coordinate display
├── context/
│   └── AppContext.jsx         # Shared state (incidents, weather, alerts, sound)
├── main.jsx
└── index.css                  # All styles (dark tactical HUD aesthetic)
```

---

## About

Made at **Bauhaus-Universität Weimar** as part of an urban design studio exploring surveillance, bureaucracy, and the absurdity of smart city systems. Built with AI-assisted coding (Claude Code) — no prior web development experience required.
