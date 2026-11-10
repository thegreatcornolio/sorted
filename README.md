# Sorted.ai

Sorted.ai scores written customer-service transcripts and shows the result as a live pulse. Voice, email, and WhatsApp are already text when they arrive. The app does not transcribe audio.

The live scorer is one Azure OpenAI chat completion per file. It estimates NPS and CSAT. The demo at `/demo` is a separate, scripted desk. It uses keyword rules and a next best action on a negative demo score. Those rules do not score the live pulse.

Nothing in this repository is an API key or a storage connection string.

## The live site

https://sorted.trilogybpo.com

| Page | What it shows |
| --- | --- |
| `/` and `/live` | Home pulse. NPS and CSAT for scored transcripts, the sentiment mix, the top detractor reasons, and one evidence quote. |
| `/live/interactions` | Live interactions. Scored files from that pulse, newest first. |
| `/live/vulnerable` | Vulnerable customers on medical inbound calls. NPS and CSAT stay. Each person, why they were categorised, and a suggested next step. |
| `/demo` | Scripted demo of the same desk shape: voice, email, and WhatsApp. |
| `/demo/interactions` | The scripted queue. `/interactions` and `/nadclinic` open this same queue. |
| `/scoring` | Score model for the demo, including Replay. It sits with the demo menu. |

The live menu is Live, Interactions, and Vulnerable Customers. Demo is a separate link.

The home NPS dial runs from −100 to +100. It is the share of promoters minus the share of detractors. Promoters are predicted 9–10, passives are 7–8, and detractors are 0–6. Passives stay in the count and are left out of the subtraction. The CSAT dial is the average of the 1–5 estimates. The page draws immediately, shows a short waiting line, and stops the pulse request after a few seconds with a retry. It refreshes every 30 seconds.

A top detractor reason opens `/live/interactions?reason=…` when the pulse includes `calls`. That list is the detractor calls for that reason, newest first. Opening one shows the file, the reason, the quote, the NPS band, and CSAT. The evidence quote opens the call it was taken from. The pulse response has to include `calls` for those links to appear. An older running revision of the container omits `calls`, and the reason and the quote stay plain text until a new revision is serving the site.

These live transcripts have no channel field, and the page does not add one.

The home page can clear results, and it can clear stored transcripts after a confirmation. See [Clear the pulse](#clear-the-pulse).

`/live/vulnerable` lists people the scorer marked vulnerable. The score JSON includes `vulnerable` (true or false), `vulnerability_reason`, and `next_step`. `vulnerable` is true only for trouble paying, a late payment, or a change in circumstances that means they cannot pay. Saying they cannot afford the service, including “I can't afford that”, is trouble paying. Ordinary price dislike is a high or unfair price when they can still pay, and it is not vulnerable. When `vulnerable` is false, `vulnerability_reason` and `next_step` are empty unless the call shows they cannot afford or cannot pay. When it is true, `vulnerability_reason` is why they were categorised and `next_step` is one suggested next step. Each row is the person, that reason, and that next step. `GET /api/pulse` returns those people as `vulnerable`. A detractor already on the pulse whose reason or quote says they cannot afford the service is listed from that call, with a reason and a next step, even when an older container omitted `vulnerable`. NPS and CSAT stay on the page. Scoring still uses deployment `sorted-score` on `sorted-openai`.

## GitHub Pages

https://sorted.trilogybpo.com is a GitHub Pages site of the `main` branch. Pages serves the static HTML committed at the repository root. The `CNAME` file at that root is `sorted.trilogybpo.com`.

`npm run build` writes a static export to `out/`. `out/` is gitignored. The workflow in `.github/workflows/pages.yml` builds that export and uploads a Pages artifact. The Actions artifact is not what the domain serves. To change the live site, commit the exported HTML on `main` (`index.html`, `live/`, `demo/`, and the rest of the export). Copy the contents of `out/` onto the repository root. Leave `out/` itself untracked.

`.github/workflows/build.yml` runs the site check and the export on pull requests. It does not publish the domain.

`functions/` is not part of the site build.

## Run the site locally

Use Node.js 22.

```bash
npm install
npm run dev
```

- Home pulse and `/live`: http://localhost:3000
- Live interactions: http://localhost:3000/live/interactions
- Vulnerable customers: http://localhost:3000/live/vulnerable
- Demo: http://localhost:3000/demo
- Demo interactions: http://localhost:3000/demo/interactions
- Score model: http://localhost:3000/scoring

The browser asks the container for `GET /api/pulse`. That response allows only `https://sorted.trilogybpo.com`, so the live numbers show on the public site. The same pages on localhost draw the desk and then report that the scored transcripts did not load.

The public origin is `baseUrl` in `public/sentiment-pulse-config.json`:

`https://sorted-pulse.thankfulflower-819372b8.westus3.azurecontainerapps.io`

The path is `/api/pulse`. A build can set `NEXT_PUBLIC_SENTIMENT_PULSE_BASE_URL` to that same origin instead. The site does not contain a storage key.

```bash
npm run check
npm run build
```

`npm run check` confirms every demo score quotes a customer line, that a negative demo NPS or CSAT has its own next best action, and that the live pulse math matches the container.

## Storage

Storage account `trilogybpo`.

| Place | Role |
| --- | --- |
| Blob container `incomingtranscripts` | Drop transcripts here. |
| Blob container `processedtranscripts` | A scored file moves here, under the same name. |
| `processedtranscripts/results/` | One JSON result per file, and one error JSON when scoring fails. |
| Table `SentimentPulse` | The pulse. One record holds the calls behind `GET /api/pulse`. |

The scorer does not create the blob containers. Create `incomingtranscripts` and `processedtranscripts` before the first poll. It creates the `SentimentPulse` table if that table is missing. It does not write Azure SQL.

`GET /api/pulse` reads that one table record. It does not list blobs, score files, or call Azure OpenAI. When `processedtranscripts` has no `results/*.json`, the next poll rewrites the table record as an empty pulse. When result JSON is present and the table record has never been written, that poll copies the results in. A written empty pulse is not copied back from the blobs.

## Container app

Container app `sorted-pulse`. Image `sortedpulse.azurecr.io/sorted-transcripts:latest`. The process listens on port 8080 and polls `incomingtranscripts` every 15 seconds. The same process serves the pulse.

Building the image does not switch the running revision. A new revision of `sorted-pulse` is required before the site is talking to the new image. Until that revision is running, the public pulse is the previous build. That is why a merged scoring change can leave reasons as plain text: the committed pages expect `calls`, and the running revision may still omit it.

Rebuild from `main` after the scoring change is on `main`:

```bash
az acr build --registry sortedpulse --image sorted-transcripts:latest --file functions/Dockerfile https://github.com/thegreatcornolio/sorted.git#main
```

Then create a new revision of `sorted-pulse` that runs `sortedpulse.azurecr.io/sorted-transcripts:latest`.

The image build uses the repository root as its context and `functions/Dockerfile`. It compiles `functions/` with `tsc`. It does not build the site. Locally, from the repository root:

```bash
docker build -f functions/Dockerfile -t sorted-transcripts .
```

The image command is `node dist/container.js`.

## Azure OpenAI

One Azure OpenAI resource is enough for NPS, CSAT, and vulnerable-customer scoring.

The resource Sorted.ai uses:

| | |
| --- | --- |
| Resource | `sorted-openai` |
| Deployment | `sorted-score` |
| Model | `gpt-4o` |
| Endpoint | `https://sorted-openai.openai.azure.com/` |
| API version | `2024-12-01-preview` |

The key stays in the container setting `AZURE_OPENAI_API_KEY`. Do not commit it, and do not paste it into the repo. The endpoint has no path, query, or key.

The deployment must accept chat completions with `response_format` `json_schema` and `strict: true`. Each transcript is one completion. The model returns `predicted_nps` (a whole number from 0 to 10), `nps_category` (promoter, passive, or detractor), `sentiment_start`, `sentiment_end`, `resolved`, `csat` (1–5), `primary_reason`, an evidence quote, a `summary`, `vulnerable`, `vulnerability_reason`, and `next_step`. The instruction is to judge the whole call and weigh the ending. A booked, paid close is not a detractor. A caller who books and pays after disliking the price or the wait is a promoter at 9 with CSAT 4. A clearly pleased close can be 10 with CSAT 5. An unresolved complaint, refusal, cancellation, or angry ending stays a detractor with CSAT 1 or 2. A genuinely undecided caller is passive with CSAT 3. The evidence quote must be a real sentence copied from the transcript.

`sentiment_end` is the sentiment stored for the pulse. `predicted_nps` is stored as `predictedNps`. `csatBand` is positive for 4–5, neutral for 3, and negative for 1–2.

## Environment variables

Set these on the container app. The image does not contain them. For a local run, put the same names in the environment, or in `functions/local.settings.json` under `Values`. That file is gitignored. `npm run once`, `npm start`, and `npm run upload` in `functions/` read it when the variable is not already set.

| Name | What to put |
| --- | --- |
| `SORTED_STORAGE_CONNECTION_STRING` | Connection string for storage account `trilogybpo`. |
| `AZURE_OPENAI_ENDPOINT` | `https://sorted-openai.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | A key for `sorted-openai`. |
| `AZURE_OPENAI_DEPLOYMENT` | `sorted-score` |
| `AZURE_OPENAI_API_VERSION` | `2024-12-01-preview` |

## Drop a transcript

Put the file in `incomingtranscripts`. The next poll scores it.

On success the file moves to `processedtranscripts`, the score is written to `processedtranscripts/results/<name>.json`, and the same score is added to `SentimentPulse`. Any previous `results/<name>.error.json` is removed.

On failure the file stays in `incomingtranscripts` for the next poll to retry. The error is written to `processedtranscripts/results/<name>.error.json` as `file`, `error`, and `failedAt`.

A file must be text, must not be empty, and must be at most 2 MB. Plain text is fine, including lines that start with `customer:`, `agent:`, `advisor:`, or `caller:`. JSON can be a `lines` array, a `text` or `transcript` string, or a speech-recognition payload that already has `text`. An optional survey number in the file (`nps` or `score`, a whole number from 0 to 10) is stored as `nps`. A `company:` line or JSON `company` is stored as `company`.

Predicted NPS is an estimate, not a survey score. The 0–10 figure is the model’s judgment of the call. A survey number already written in the file is stored beside it and is not the number on the pulse. `GET /api/pulse` does not return `nps`. Speech-recognition `confidence` is not a score.

From `functions/`, with the five variables set:

```bash
npm install
npm run once
```

`npm run once` scores whatever is already in `incomingtranscripts` and exits. `npm start` builds and runs the same poll and HTTP server as the container, on port 8080.

`npm run upload` serves a local page at http://127.0.0.1:8787/. That page is not on sorted.trilogybpo.com. It only puts `.txt`, `.text`, `.md`, `.json`, or extensionless files into `incomingtranscripts`. The container scores them.

`npm run check` in `functions/` runs the scorer tests.

## Clear the pulse

`POST /api/clear-results` is the Clear results button. It deletes the score files `results/<file>.json`, writes an empty `SentimentPulse` record, and leaves the moved transcript files and any `results/<file>.error.json` in `processedtranscripts`. The next poll does not refill the table from the deleted JSON.

`POST /api/clear-transcripts` is the Clear transcripts button at the bottom of the home pulse. It deletes every blob in `processedtranscripts`, including the moved transcripts, `results/*.json`, and `results/*.error.json`, then writes an empty `SentimentPulse` record. It leaves `incomingtranscripts` in place, and it does not delete the blob container. The page asks for confirmation first.
