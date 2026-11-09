# SORTED.AI

NPS and CSAT customer interactions support. Voice, email, and WhatsApp are already written down. The app scores them for a generic customer-service team. It does not transcribe audio.

## Run

```bash
npm install
npm run dev
```

- Scored transcripts: http://localhost:3000 and https://sorted.trilogybpo.com/
- Demo queue: http://localhost:3000/demo and https://sorted.trilogybpo.com/demo/
- Interaction desk: http://localhost:3000/interactions and http://localhost:3000/nadclinic
- Score model: http://localhost:3000/scoring

The main page reads `GET /api/pulse` on the Azure Function, the aggregate of processed transcripts. The Function App origin is the public `baseUrl` in `public/sentiment-pulse-config.json`: `https://sorted-pulse.thankfulflower-819372b8.westus3.azurecontainerapps.io`. The path is `/api/pulse`. A build can set `NEXT_PUBLIC_SENTIMENT_PULSE_BASE_URL` to the same origin. These call transcripts have no channel field, and the page does not add one. The site does not contain a storage key.

The demo at `/demo` is the simulated queue. The main page has a button that opens it. That demo Sentiment Pulse uses the same queue as its NPS and CSAT dials.

`npm run build` writes a static site to `out/`. GitHub Pages publishes that build for the custom domain. `functions/` is not part of the site build.

`npm run check` confirms every score quotes a customer line, and that negative NPS or CSAT values trigger a distinct next best action.
