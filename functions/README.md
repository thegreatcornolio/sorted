# Transcript scoring

This is the Sorted.ai scorer. Setup for the site, storage account `trilogybpo`, container app `sorted-pulse`, and Azure OpenAI resource `sorted-openai` is in the repository [README](../README.md).

The container polls `incomingtranscripts` every 15 seconds and scores each file with one Azure OpenAI chat completion. The image command is `node dist/container.js`. It listens on port 8080. It is not part of the static site, and it does not add a page to https://sorted.trilogybpo.com. The demo’s keyword rules are a separate desk. They do not score the live pulse.

## What gets stored

Predicted NPS is an estimate, not a survey score. The model returns `predicted_nps`, a whole number from 0 to 10, stored as `predictedNps`. A survey number already written in the file is stored as `nps` and stays null when the file has none. Speech-recognition `confidence` is not a score. `GET /api/pulse` does not return `nps`.

The completion also returns `nps_category` (promoter for 9–10, passive for 7–8, detractor for 0–6), `sentiment_start`, `sentiment_end`, `resolved`, `csat` (1–5), `primary_reason`, an evidence quote, a `summary`, `vulnerable`, `vulnerability_reason`, and `next_step`. The instruction is to judge the whole call and weigh the ending. A booked, paid close is not a detractor. A caller who books and pays after disliking the price or the wait is a promoter at 9 with CSAT 4. A clearly pleased close can be 10 with CSAT 5. An unresolved complaint, refusal, cancellation, or angry ending stays a detractor with CSAT 1 or 2. A genuinely undecided caller is passive with CSAT 3. The evidence quote must be a real sentence copied from the transcript. `vulnerable` is true only when the caller has trouble paying, is late on payments, or mentions a change in circumstances that means they cannot pay. Ordinary price dislike is not vulnerable. When it is false, `vulnerability_reason` and `next_step` are empty. When it is true, those two fields are one short reason and one short suggested next step. The same three fields are stored on the `SentimentPulse` record.

`sentiment_end` is the sentiment stored for the pulse. `csatBand` is positive for 4–5, neutral for 3, and negative for 1–2.

The deployment must accept chat completions with `response_format` `json_schema` and `strict: true`. One Azure OpenAI resource is enough for NPS, CSAT, and vulnerable-customer scoring. The resource is `sorted-openai`, deployment `sorted-score`, model `gpt-4o`, endpoint `https://sorted-openai.openai.azure.com/`, API version `2024-12-01-preview`. The page at `/live/vulnerable` reads `vulnerable` from `GET /api/pulse`. An older running revision omits that list until a new revision of `sorted-pulse` is deployed.

## Files

Drop a file in blob container `incomingtranscripts` on storage account `trilogybpo`.

On success the blob moves to `processedtranscripts`, keeping its name. The JSON result is `processedtranscripts/results/<file>.json`, including `vulnerable`, `vulnerability_reason`, and `next_step`. The same score is written to table `SentimentPulse`. On failure the file stays in `incomingtranscripts` for the next poll to retry, and the error is `processedtranscripts/results/<file>.error.json`.

The process does not create the blob containers. It creates `SentimentPulse` if the table is missing. It does not write Azure SQL. A file must be text, non-empty, and at most 2 MB.

## Pulse

The same container serves `GET /api/pulse`. The site calls it with no storage key. The response is that one `SentimentPulse` record: mix, promoter and detractor counts, average `csat`, reasons, one evidence quote, movement, `calls` (each detractor’s file, reason, quote, NPS band, and CSAT), and `vulnerable` (each person, `vulnerability_reason`, and `next_step`). It does not list result blobs, and it does not call Azure OpenAI. CORS allows only `https://sorted.trilogybpo.com`.

When `processedtranscripts` has no `results/*.json`, the next poll rewrites `SentimentPulse` as an empty pulse. When result JSON is present and the table record has never been written, that poll copies it in. A written empty pulse is not copied back. A failed read returns JSON immediately.

`POST /api/clear-results` deletes the score files `results/<file>.json`, writes an empty `SentimentPulse` record, and leaves the moved transcripts and any `results/<file>.error.json` where they are. `POST /api/clear-transcripts` deletes every blob in `processedtranscripts`, including transcripts, result JSON, and error JSON, then writes an empty record. It does not delete `incomingtranscripts` or the blob container.

## Run

The five settings are `SORTED_STORAGE_CONNECTION_STRING`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, and `AZURE_OPENAI_API_VERSION`. Values for the resources above are in the repository README. Set them on container app `sorted-pulse`. The image `sortedpulse.azurecr.io/sorted-transcripts:latest` does not contain them.

Building that image does not switch the running revision. Create a new revision of `sorted-pulse` after:

```bash
az acr build --registry sortedpulse --image sorted-transcripts:latest --file functions/Dockerfile https://github.com/thegreatcornolio/sorted.git#main
```

Locally, from the repository root, `docker build -f functions/Dockerfile -t sorted-transcripts .` compiles this package and does not build the site.

From this directory, with the five variables set (or in gitignored `local.settings.json` under `Values`):

```bash
npm install
npm run once    # score incomingtranscripts once
npm start       # poll and serve the pulse on port 8080
npm run upload  # http://127.0.0.1:8787/ — puts files in incomingtranscripts only
npm run check
```

The upload page is not on sorted.trilogybpo.com.
