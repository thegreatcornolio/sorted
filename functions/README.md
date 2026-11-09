# Transcript scoring

A container polls the blob container `incomingtranscripts` and scores each new file. It is not part of the static site, and it does not add a page to sorted.trilogybpo.com.

Each file is scored for a Sentiment Pulse. Sentiment mix uses the same three buckets as the overview: positive, neutral, and negative. Mixed text, and text with no clear wording, counts as neutral. A file with a real NPS or score from 0 to 10 also records promoter (9–10), passive (7–8), or detractor (0–6), a detractor reason, and one evidence line. Plain text with no score still gets a sentiment mix and one evidence line, and NPS stays blank.

Call transcripts are one JSON object: `text`, `confidence`, `audio_duration`, `words`, and `redacted_pii_policies`. `confidence` is speech-recognition confidence, not a survey score. The pulse for those files comes from what was said: promoter, passive, or detractor, a reason, and one quote of at most 280 characters taken from `text`. The result leaves `nps` blank. It does not invent an NPS or CSAT number.

After a successful score the blob moves to the `processedtranscripts` container, keeping its name. The JSON result is written in that same container as `results/<file>.json`. The same score is also written to the Azure Table `SentimentPulse` in that storage account. On failure the file stays in `incomingtranscripts` and the error is written beside the result as `results/<file>.error.json`. The process does not create blob containers. It creates the `SentimentPulse` table if it is missing.

The same container serves `GET /api/pulse`. sorted.trilogybpo.com can call it with no storage key. The response is read from the `SentimentPulse` table in one call: mix, promoter and detractor counts, reasons, one evidence quote, and movement. It does not list result blobs. CORS allows only `https://sorted.trilogybpo.com`. `nps` is not in that response. The first poll copies existing result JSON into the table when the table is empty. Later polls do not.

The storage connection is the environment variable `SORTED_STORAGE_CONNECTION_STRING`. Do not commit it. The image does not contain it. The process reads that variable only, and it listens on port 8080.

The image build uses the repo root as its context and `functions/Dockerfile`, so it compiles this package with `tsc` and does not run the site build. From the repo root:

```bash
docker build -f functions/Dockerfile -t sorted-transcripts .
```

`npm run upload` serves a local page at http://127.0.0.1:8787/. That page is not on sorted.trilogybpo.com. It only puts files in `incomingtranscripts`. The container scores them, and successes move to `processedtranscripts`.
