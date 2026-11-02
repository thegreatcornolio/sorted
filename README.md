# SORTED.AI

Live transcript desk for a business-fiber sales and support team. The app reads call transcripts that have already been produced. It does not transcribe audio.

## Run

```bash
npm install
npm run dev
```

- Transcript desk: http://localhost:3000
- Same desk (redirect): http://localhost:3000/nadclinic
- Score model: http://localhost:3000/scoring

`npm run check` confirms every score quotes a customer line, and that negative NPS or CSAT values trigger a distinct next best action.
