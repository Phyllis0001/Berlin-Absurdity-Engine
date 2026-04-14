# Berlin Absurdity Engine

A tactical city-monitoring web app set in Berlin. Incidents (real and nonsense) spawn across the city, each with an AI-generated "solution" that makes things dramatically worse. Built for an urban design studio at university.

## What it does

- **3D Berlin map** — dark tactical aesthetic, orbiting camera, 3D buildings
- **Incident system** — spawn normal problems (car crash, fire, traffic jam) or absurd ones (ghost, slow walker, bird threat) and watch them appear on the map with custom markers
- **AI Response Unit** — click any active incident to get a hilariously useless AI analysis
- **Weather & seasons** — change atmosphere with the ENV_MODULATOR dial (rain, fog, heatwave, storm, etc.)
- **Zone status** — five tactical sectors across Berlin, live threat levels
- **Logic Feed** — real-time system log with made-up sensor data
- **Bio Supervisor** — optional webcam feed with face-detection targeting reticle

## Setup

Make sure you have [Node.js](https://nodejs.org) (v18+) installed.

```bash
# Install dependencies
npm install

# Start the dev server (opens at http://localhost:5173)
npm run dev

# Build for production
npm run build
```

## Deploying to GitHub Pages

1. Push this repo to GitHub
2. In the repo settings, go to **Pages → Source → GitHub Actions**
3. Open `.github/workflows/deploy.yml` and change `VITE_BASE` to match your repo name:
   ```yaml
   VITE_BASE: /your-repo-name/
   ```
4. Push to `main` — the site deploys automatically

## Tech stack

- [Vite](https://vitejs.dev) + [React](https://react.dev)
- [MapLibre GL JS](https://maplibre.org) — open-source map rendering
- [OpenFreeMap](https://openfreemap.org) — free map tiles (no API key needed)
- [Tailwind CSS](https://tailwindcss.com)
- [react-icons](https://react-icons.github.io)
