# Transcript scoring

A container polls the blob container `incomingtranscripts` and scores each new file with Azure OpenAI in your tenant. It is not part of the static site, and it does not add a page to sorted.trilogybpo.com. Keyword rules are not the live scorer.

Each transcript is one chat completion. The response is strict JSON: `predicted_nps` (a whole number from 0 to 10), `nps_category` (promoter for 9–10, passive for 7–8, detractor for 0–6), `sentiment_start`, `sentiment_end`, `resolved`, `csat` (1–5), `primary_reason`, an evidence quote, a `summary`, `vulnerable`, `vulnerability_reason`, and `next_step`. The instruction is to judge the whole call and weigh the ending. A booked, paid close is not a detractor. A caller who books and pays after disliking the price or the wait is a promoter at 9 with CSAT 4. A clearly pleased close can be 10 with CSAT 5. An unresolved complaint, refusal, cancellation, or angry ending stays a detractor with CSAT 1 or 2. A genuinely undecided caller is passive with CSAT 3. The evidence quote must be a real sentence copied from the transcript, never a fragment such as “O.” `vulnerable` is true only when the caller has trouble paying, is late on payments, or mentions a change in circumstances that means they cannot pay. Ordinary price dislike is not vulnerable. When it is false, `vulnerability_reason` and `next_step` are empty. When it is true, those two fields are one short reason and one short suggested next step. The same three fields are stored on the `SentimentPulse` record. `GET /api/pulse` returns them as `vulnerable`, a list of those people, so the page does not scan blobs.

The deployment must accept chat completions with `response_format` `json_schema` and `strict: true`. API version `2024-10-21` is a known fit for that, on a deployment such as GPT-4o. `sentiment_end` is the sentiment stored for the pulse. `predicted_nps` is stored as `predictedNps`. A survey number already written in the file is stored as `nps`; otherwise `nps` stays null. Speech-recognition `confidence` is not a score. `csatBand` is positive for 4–5, neutral for 3, and negative for 1–2.

After a successful score the blob moves to the `processedtranscripts` container, keeping its name. The JSON result is written in that same container as `results/<file>.json`. The same score is also written to the Azure Table `SentimentPulse` in that storage account. That table is the fast store: one row holds the calls behind the pulse. On failure the file stays in `incomingtranscripts` and the error is written beside the result as `results/<file>.error.json`. The process does not create blob containers. It creates the `SentimentPulse` table if it is missing. It does not write Azure SQL.

The same container serves `GET /api/pulse`. sorted.trilogybpo.com can call it with no storage key. The response is read from the `SentimentPulse` table in one call: mix, promoter and detractor counts, average `csat`, reasons, one evidence quote, movement, `calls` (each detractor), and `vulnerable` (each person, `vulnerability_reason`, and `next_step`). It does not list result blobs, and it does not call Azure OpenAI. CORS allows only `https://sorted.trilogybpo.com`. `nps` is not in that response. When `processedtranscripts` has no `results/*.json`, the next poll rewrites the `SentimentPulse` record as an empty pulse. When result JSON is present and the table record is missing, that poll copies it in. A written empty pulse is not copied back. `GET /api/pulse` reads only that one table record. It does not list blobs, score files, or wait for the poll. A failed read returns JSON immediately.

`POST /api/clear-results` is the Clear results button. It deletes `results/*.json`, writes an empty `SentimentPulse` record, and leaves the moved transcript files where they are. The response is that empty pulse. The next poll does not refill the table from the deleted JSON.

`POST /api/clear-transcripts` is the Clear transcripts button. It deletes every blob in `processedtranscripts`, including the moved transcript files, `results/*.json`, and `results/*.error.json`, then writes an empty `SentimentPulse` record. It does not delete blobs in `incomingtranscripts`, and it does not delete the container. The live page asks for confirmation before it calls this route.

Settings are environment variables on the container app. Do not commit them. The image does not contain them. Set these five:

| Name | What to put |
| --- | --- |
| `SORTED_STORAGE_CONNECTION_STRING` | Storage account that holds `incomingtranscripts`, `processedtranscripts`, and the `SentimentPulse` table. |
| `AZURE_OPENAI_ENDPOINT` | Resource endpoint, such as `https://<name>.openai.azure.com`. No path, query, or key. |
| `AZURE_OPENAI_API_KEY` | A key for that Azure OpenAI resource. |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name to call. |
| `AZURE_OPENAI_API_VERSION` | API version for that deployment, such as `2024-10-21`. |

The process reads those variables only, and it listens on port 8080.

The image build uses the repo root as its context and `functions/Dockerfile`, so it compiles this package with `tsc` and does not run the site build. From the repo root:

```bash
docker build -f functions/Dockerfile -t sorted-transcripts .
```

`npm run upload` serves a local page at http://127.0.0.1:8787/. That page is not on sorted.trilogybpo.com. It only puts files in `incomingtranscripts`. The container scores them, and successes move to `processedtranscripts`.
