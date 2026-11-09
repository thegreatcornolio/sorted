# SORTED.AI

NPS and CSAT customer interactions support. Voice, email, and WhatsApp are already written down. The app scores them for a generic customer-service team. It does not transcribe audio.

## Run

```bash
npm install
npm run dev
```

- Demo queue: http://localhost:3000 and https://sorted.trilogybpo.com/
- Live scores: http://localhost:3000/live and https://sorted.trilogybpo.com/live/
- Interaction desk: http://localhost:3000/interactions and http://localhost:3000/nadclinic
- Score model: http://localhost:3000/scoring

The main page is the simulated queue. It links to the live scores at `/live`. That demo Sentiment Pulse uses the same queue as its NPS and CSAT dials.

`/live` reads `GET /api/pulse` on `https://sorted-pulse.thankfulflower-819372b8.westus3.azurecontainerapps.io`, the aggregate of processed transcripts. The page draws immediately, shows a short waiting line, and stops the request after a few seconds with a retry. The Function App origin is the public `baseUrl` in `public/sentiment-pulse-config.json`. The path is `/api/pulse`. A build can set `NEXT_PUBLIC_SENTIMENT_PULSE_BASE_URL` to the same origin. These call transcripts have no channel field, and the page does not add one. The site does not contain a storage key.

`npm run build` writes a static site to `out/`. GitHub Pages publishes that build for the custom domain. `functions/` is not part of the site build.

`npm run check` confirms every score quotes a customer line, and that negative NPS or CSAT values trigger a distinct next best action.
