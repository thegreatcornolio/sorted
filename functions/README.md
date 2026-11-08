# Transcript scoring

A container polls the blob container `incomingtranscripts` and scores each new file. It is not part of the static site, and it does not add a page to sorted.trilogybpo.com.

Each file is scored for a Sentiment Pulse. Sentiment mix uses the same three buckets as the overview: positive, neutral, and negative. Mixed text, and text with no clear wording, counts as neutral. A file with a real NPS or score from 0 to 10 also records promoter (9–10), passive (7–8), or detractor (0–6), a detractor reason, and one evidence line. Plain text with no score still gets a sentiment mix and one evidence line, and NPS stays blank.

Call transcripts are one JSON object: `text`, `confidence`, `audio_duration`, `words`, and `redacted_pii_policies`. `confidence` is speech-recognition confidence, not a survey score. The pulse for those files comes from what was said: promoter, passive, or detractor, a reason, and one quote of at most 280 characters taken from `text`. The result leaves `nps` blank. It does not invent an NPS or CSAT number.

After a successful score the blob moves to the `processedtranscripts` container, keeping its name. The JSON result is written in that same container as `results/<file>.json`. On failure the file stays in `incomingtranscripts` and the error is written beside the result as `results/<file>.error.json`. The process does not create containers.

The same container serves `GET /api/pulse`. sorted.trilogybpo.com can call it with no storage key. The response is the Sentiment Pulse aggregate: mix, promoter and detractor counts, reasons, one evidence quote, and movement. CORS allows only `https://sorted.trilogybpo.com`. `nps` is not in that response.

The storage connection is the environment variable `SORTED_STORAGE_CONNECTION_STRING`. Do not commit it. The image does not contain it. The process reads that variable only, and it listens on port 8080.

From the repo root, build the image with:

```bash
docker build -t sorted-transcripts functions
```

`npm run upload` serves a local page at http://127.0.0.1:8787/. That page is not on sorted.trilogybpo.com. It only puts files in `incomingtranscripts`. The container scores them, and successes move to `processedtranscripts`.
