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

The overview Sentiment Pulse uses the same live queue as the NPS and CSAT dials.

`npm run build` writes a static site to `out/`. GitHub Pages publishes that build for the custom domain.

`npm run check` confirms every score quotes a customer line, and that negative NPS or CSAT values trigger a distinct next best action.

## Transcript uploads

People drop transcript files into the blob container `incomingtranscripts` themselves. There is no prefix and no upload page. The live demo queue is unchanged.

Create a container named `processed` if it does not exist. After a successful score, the function moves the transcript blob there, keeping its blob name. JSON results are written in that same container under `results/<file>.json`. Sentiment mix uses the same three buckets as the overview: positive, neutral, and negative. Mixed text, and text with no clear wording, counts as neutral. A file with an NPS or score from 0 to 10 also records promoter (9–10), passive (7–8), or detractor (0–6), a detractor reason, and one evidence line. Plain text with no score still gets a sentiment mix and one evidence line, and NPS stays blank.

On failure the file stays in `incomingtranscripts` and the error is written beside the result as `results/<file>.error.json` in the `processed` container. The function creates `processed` when it is missing.

The storage connection is `SORTED_STORAGE_CONNECTION_STRING`. Do not commit it. Copy `functions/local.settings.json.example` to `functions/local.settings.json` and set the value there. `AzureWebJobsStorage` in that file is only for the Functions host. The example points the host at Azurite (`UseDevelopmentStorage=true`). For Azurite, use the emulator connection string from the Azurite docs (account `devstoreaccount1`, blob endpoint `http://127.0.0.1:10000/devstoreaccount1`) as `SORTED_STORAGE_CONNECTION_STRING`.

The function is not deployed. From `functions/`, with Node 20 or newer:

```bash
npm install
npm start
```

`npm start` needs Azure Functions Core Tools v4. It builds the function and starts the host. The timer reads `incomingtranscripts` once a minute, and also once when the host starts. `POST http://localhost:7071/api/score-transcripts` scores one pass. The host prints the function key that request needs.

`npm run once` scores one pass without the Functions host. Run it from `functions/` so it can read `local.settings.json`. It uses the same connection string and does not deploy anything.
