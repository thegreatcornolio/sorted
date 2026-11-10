# SORTED.AI

NPS and CSAT customer interactions support. Voice, email, and WhatsApp are already written down. The app scores them for a generic customer-service team. It does not transcribe audio.

## Run

```bash
npm install
npm run dev
```

- Live scores: http://localhost:3000 and https://sorted.trilogybpo.com/ (`/live` is the same page)
- Live interactions: http://localhost:3000/live/interactions
- Demo: http://localhost:3000/demo
- Demo interactions: http://localhost:3000/demo/interactions and http://localhost:3000/nadclinic
- Score model: http://localhost:3000/scoring

`/` is the live pulse. `/live` opens that same page. The live menu is Live and Interactions. Demo is a separate link, and Score model sits with the demo. `/live/interactions` lists the scored files in the pulse. The demo overview and the demo interactions page keep the scripted queue.

`calls` on that pulse lists each detractor with its file, reason, quote, NPS band, and CSAT. A top reason opens those calls, and the evidence quote opens the call it was taken from. Scoring is unchanged.

`/` and `/live` read `GET /api/pulse` on `https://sorted-pulse.thankfulflower-819372b8.westus3.azurecontainerapps.io`, the aggregate of processed transcripts. The page draws immediately, shows a short waiting line, and stops the request after a few seconds with a retry. The Function App origin is the public `baseUrl` in `public/sentiment-pulse-config.json`. The path is `/api/pulse`. A build can set `NEXT_PUBLIC_SENTIMENT_PULSE_BASE_URL` to the same origin. These call transcripts have no channel field, and the page does not add one. The site does not contain a storage key.

The container scores each incoming transcript with Azure OpenAI and writes the result into the `SentimentPulse` table. `GET /api/pulse` reads that one table record, so the live pages do not scan blobs and do not wait on the model. The five container settings are in `functions/README.md`. Nothing in this repo is an API key or a connection string.

`npm run build` writes a static site to `out/`. The custom domain is a GitHub Pages branch site of the repository root, so the exported pages are also committed there. `out/` is gitignored and is not what sorted.trilogybpo.com serves. `functions/` is not part of the site build.

`npm run check` confirms every score quotes a customer line, and that negative NPS or CSAT values trigger a distinct next best action.
