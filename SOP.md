# SOP — Elite Writer V5

## Run locally
```bash
npm install
npm run dev:secrets   # Infisical-primary
# fallback: npm run dev
```

## Deploy
- Gate: `bash scripts/pre-pr-gate.sh`
- Production secret applies: founder-approved only

## Recover
- Roll back to prior deploy tag/image
- Restore env from backup (never wipe)
