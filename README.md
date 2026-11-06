# SORTED.AI

Live NPS and CSAT customer-interactions demo for a generic customer-service team. Channels are voice, email, and WhatsApp. The desk scores interactions that already exist. It does not transcribe audio, and it is not a fibre product.

Live site: https://sorted.trilogybpo.com

## Pages

The nav is Overview, Interactions, and Score model. The separate Sentiment page was removed. Sentiment Pulse now lives on the overview.

- **Overview** (`/` and https://sorted.trilogybpo.com): NPS and CSAT dials, plus Sentiment Pulse. The pulse is driven by the same live demo queue as the dials.
- **Interactions** (`/interactions`): the arriving stream, the reasons behind the scores, and the next best action.
- **Score model** (`/scoring`): how an interaction becomes a score. Replay sits on this page.

`/nadclinic` is the same interactions desk.

NPS is the percentage of promoters (scores 9–10) minus the percentage of detractors (scores 0–6). Passives (7–8) stay in the base and are not part of the subtraction. The dial shows that result, from −100 to +100, not an average of the 0–10 scores.

A one-page product PDF is kept outside this repository, with the project notes. It is not committed here and is not part of the site.

## Run

```bash
npm install
npm run dev
```

- Customer interactions: http://localhost:3000 and https://sorted.trilogybpo.com/
- Same desk: http://localhost:3000/nadclinic and https://sorted.trilogybpo.com/nadclinic/
- Score model: http://localhost:3000/scoring

`npm run build` writes a static site to `out/`. GitHub Pages publishes that build for the custom domain.

`npm run check` confirms every score quotes a customer line, and that negative NPS or CSAT values trigger a distinct next best action.

## QContact (parked)

Ingest from the NAD Clinic QContact tenant (`nadclinic.qcontact.com`) is parked. Sorted does not call that API.

What was checked on the tenant:

- `GET /api/v2/entities/Interaction` ignores date filters and returns a fixed list.
- Voice Interaction and Conversation records that were checked had null `body_text`, an empty recording, and null `ai_csat` and sentiment.
- Transcripts that exist are on `POST /api/v2/entities/ConversationTranscript/filter`: 25 per page, sorted by `id` ascending. An id-greater-than filter hangs.

[Homebase](https://home.trilogybpo.com) already loads those transcripts into Azure SQL `TrilogyMIS` with Power Automate (a full dump, plus a daily run at 06:00 SAST):

- `dbo.mis_conversation_transcripts`
- `dbo.mis_conversation_insights`

Homebase has insights pages for that data. There is no NPS. CSAT is a sparse 1–5 score. Transcript coverage is about 2.5% (135 of 5,457 interactions, 1 June–26 August 2026). There is no recording download.

When this work resumes, Sorted reads `TrilogyMIS` with its own flow. It does not copy signed Power Automate URLs, and it does not re-poll Interaction.
