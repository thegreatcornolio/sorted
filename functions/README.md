# Transcript scoring

Drop a transcript into the blob container `incomingtranscripts`. That drop starts scoring. This function is a blob trigger, not part of the static site, and it does not add a page to sorted.trilogybpo.com.

Each new blob is scored for a Sentiment Pulse. Sentiment mix uses the same three buckets as the overview: positive, neutral, and negative. Mixed text, and text with no clear wording, counts as neutral. A file with a real NPS or score from 0 to 10 also records promoter (9–10), passive (7–8), or detractor (0–6), a detractor reason, and one evidence line. Plain text with no score still gets a sentiment mix and one evidence line, and NPS stays blank.

Call transcripts are one JSON object: `text`, `confidence`, `audio_duration`, `words`, and `redacted_pii_policies`. `confidence` is speech-recognition confidence, not a survey score. The pulse for those files comes from what was said: promoter, passive, or detractor, a reason, and one quote of at most 280 characters taken from `text`. The result leaves `nps` blank. It does not invent an NPS or CSAT number.

After a successful score the blob moves to the `processedtranscripts` container, keeping its name. The JSON result is written in that same container as `results/<file>.json`. On failure the file stays in `incomingtranscripts` and the error is written beside the result as `results/<file>.error.json`. The function does not create containers.

`npm run upload` serves a local page at http://127.0.0.1:8787/. That page is not on sorted.trilogybpo.com. It only puts files in `incomingtranscripts`. The blob trigger scores them, and successes move to `processedtranscripts`.

The storage connection is the app setting `SORTED_STORAGE_CONNECTION_STRING`. Do not commit it. Copy `local.settings.json.example` to `local.settings.json` and set the value there for a local run. `AzureWebJobsStorage` is the Functions host storage, separate from that setting. The example points the host at Azurite (`UseDevelopmentStorage=true`).

From this folder, with Node 20 or newer and Azure Functions Core Tools v4:

```bash
npm install
npm start
```

`npm start` builds the function and starts the host. A blob that lands in `incomingtranscripts` is scored by the trigger. The host reads `SORTED_STORAGE_CONNECTION_STRING` from `local.settings.json`.

Deploy with one command, from this folder, after the Function App exists and the app setting is set in Azure:

```bash
func azure functionapp publish <FunctionAppName>
```

This repo does not run that command. `host.json` is the host config, and `src/index.ts` registers the blob trigger on `incomingtranscripts/{name}` with connection `SORTED_STORAGE_CONNECTION_STRING`. The trigger uses container scanning, so the deploy does not add Event Grid. `.funcignore` keeps `local.settings.json` out of the published package.
