# SORTED.AI

NPS and CSAT customer interactions support. Voice, email, and WhatsApp are already written down. The app scores them for a generic customer-service team. It does not transcribe audio.

## Run

```bash
npm install
npm run dev
```

- Customer interactions: http://localhost:3000 and https://sorted.trilogybpo.com/
- Same desk: http://localhost:3000/nadclinic and https://sorted.trilogybpo.com/nadclinic/
- Score model: http://localhost:3000/scoring
- Sentiment Pulse, illustrative sample: http://localhost:3000/sentiment and https://sorted.trilogybpo.com/sentiment/

`npm run build` writes a static site to `out/`. GitHub Pages publishes that build for the custom domain.

`npm run check` confirms every score quotes a customer line, and that negative NPS or CSAT values trigger a distinct next best action.
