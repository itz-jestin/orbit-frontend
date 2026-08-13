# Orbit — Research Assistant (Frontend)

React frontend for the Orbit multi-agent research assistant. Streams live research results from the backend and provides user auth, research history, and PDF report downloads.

**Live App**: https://6a7d446e627d58ddd0651cf6--orbitresearchagent.netlify.app/
**Backend API**: https://orbit-backend-lu7c.onrender.com

## Tech Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Routing**: React Router
- **Forms**: React Hook Form + Zod
- **Data fetching**: TanStack Query
- **Animation**: Framer Motion
- **3D**: React Three Fiber (if used for visuals)
- **Deployment**: Netlify

> Note: this project was scaffolded from a Vite + Express fullstack starter template. The bundled `server/` (Express) is not used in production — the app talks directly to the FastAPI backend instead.

## Project Structure

```
frontend/
├── client/              # React app source
│   ├── lib/
│   │   ├── auth.ts              # Auth API calls (login/register)
│   │   └── research-stream.ts   # Streaming research API calls (SSE)
│   └── ...                       # Components, pages, etc.
├── server/               # Bundled Express server (unused in production)
├── shared/                # Shared types/utilities
├── public/
├── netlify.toml           # Netlify build config
├── vite.config.ts
└── package.json
```

## Local Setup

1. Clone the repo and navigate to `frontend/`
2. Install dependencies (uses pnpm):
   ```bash
   pnpm install
   ```
3. Create a `.env` file with:
   ```
   VITE_RESEARCH_API_URL=http://localhost:8000
   ```
   (point this at your local or deployed backend URL, no trailing slash)
4. Run the dev server:
   ```bash
   pnpm dev
   ```
5. Visit `http://localhost:8080` (or the port Vite prints).

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_RESEARCH_API_URL` | Base URL of the FastAPI backend (e.g. `https://orbit-backend-lu7c.onrender.com`) |

## Build

```bash
pnpm run build:client
```
Outputs static files to `dist/spa`.

## Deployment

Deployed on [Netlify](https://netlify.com), using the existing `netlify.toml`:
- Build command: `npm run build:client`
- Publish directory: `dist/spa`

To deploy your own instance:
1. Push this repo to GitHub
2. Import into Netlify (auto-detects build settings from `netlify.toml`)
3. Set `VITE_RESEARCH_API_URL` in Netlify's environment variables
4. Deploy
5. Add the resulting Netlify URL to the backend's `ALLOWED_ORIGINS` on Render

## License

MIT (or update as appropriate)
