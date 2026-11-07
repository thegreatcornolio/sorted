# Transcript scoring

People drop transcript files into the blob container `incomingtranscripts`. This function is not part of the static site, and it does not add a page to sorted.trilogybpo.com.

New blobs in `incomingtranscripts` are scored for the Sentiment Pulse fields. Sentiment mix uses the same three buckets as the overview: positive, neutral, and negative. Mixed text, and text with no clear wording, counts as neutral. A file with an NPS or score from 0 to 10 also records promoter (9–10), passive (7–8), or detractor (0–6), a detractor reason, and one evidence line. Plain text with no score still gets a sentiment mix and one evidence line, and NPS stays blank.

After a successful score the blob moves to the `processedtranscripts` container, keeping its name. The JSON result is written in that same container as `results/<file>.json`. On failure the file stays in `incomingtranscripts` and the error is written beside the result as `results/<file>.error.json`.

The storage connection is `SORTED_STORAGE_CONNECTION_STRING`. Do not commit it. Copy `local.settings.json.example` to `local.settings.json` and set the value there. `AzureWebJobsStorage` in that file is only for the Functions host. The example points the host at Azurite (`UseDevelopmentStorage=true`). For Azurite, use the emulator connection string from the Azurite docs (account `devstoreaccount1`, blob endpoint `http://127.0.0.1:10000/devstoreaccount1`).

The function is not deployed. From this folder, with Node 20 or newer:

```bash
npm install
npm start
```

`npm start` needs Azure Functions Core Tools v4. It builds the function and starts the Functions host on its own port. The timer reads `incomingtranscripts` once a minute, and also once when the host starts. `POST http://localhost:7071/api/score-transcripts` scores one pass on that host. The host prints the function key that request needs. That address is not a route on the website.

`npm run once` scores one pass without the Functions host. Run it from this folder so it can read `local.settings.json`. It uses the same connection string and does not deploy anything.
