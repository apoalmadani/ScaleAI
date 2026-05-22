# Claims Copilot

Auto-insurance claims agent assistant powered by Claude claude-sonnet-4-6. Upload a vehicle damage photo, run an AI assessment, review and edit the structured result, then approve or flag for a senior adjuster.

## Prerequisites

- Node.js 18+
- An Anthropic API key

## Local development

```bash
# 1. Install dependencies
cd claims-copilot
npm install

# 2. Add your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000.

## Build for production

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project at https://vercel.com/new (select the `claims-copilot` subdirectory as the root).
3. In **Settings → Environment Variables**, add `ANTHROPIC_API_KEY`.
4. Click **Deploy**.

Vercel auto-deploys on every push to `main`.

## Deploy to any Node host (Railway, Render, Fly.io, etc.)

```bash
npm run build
# Set ANTHROPIC_API_KEY as an environment variable in the platform dashboard
npm start          # listens on PORT env var, defaults to 3000
```

## API route

`POST /api/assess`

Request body (JSON):
```json
{ "image": "<base64 string>", "mediaType": "image/jpeg" }
```

Response (JSON):
```json
{
  "damaged_parts": ["front bumper", "hood"],
  "severity": "moderate",
  "damage_types": ["dent", "paint scratch"],
  "estimated_cost_range": "$1,200 – $2,500",
  "confidence": 0.87,
  "recommended_next_step": "Schedule in-person inspection"
}
```
