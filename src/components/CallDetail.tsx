import { sentimentLabel } from "@/lib/analyze";
import type { Analysis } from "@/lib/types";
import type { Transcript } from "@/lib/types";

function highlight(text: string, quotes: string[]) {
  const quote = quotes.find((candidate) => text.includes(candidate));
  if (!quote) return text;
  const index = text.indexOf(quote);
  return (
    <>
      {text.slice(0, index)}
      <mark>{quote}</mark>
      {text.slice(index + quote.length)}
    </>
  );
}

export function CallDetail({
  transcript,
  analysis,
  onClose,
}: {
  transcript: Transcript;
  analysis: Analysis;
  onClose: () => void;
}) {
  const tone = analysis.sentiment === "negative" ? "neg" : analysis.sentiment === "mixed" ? "mix" : "pos";
  return (
    <div className="sheet" role="presentation" onClick={onClose}>
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-top">
          <div>
            <p className="eyebrow">
              {transcript.queue} · {transcript.callTime} · {transcript.duration}
            </p>
            <h2 id="call-title">{transcript.company}</h2>
            <p className="meta">
              {transcript.contact}, {transcript.role}
              <br />
              {transcript.circuit} · agent {transcript.agent}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="score-grid">
          <article>
            <span>Sentiment</span>
            <strong>{sentimentLabel(analysis.sentiment)}</strong>
          </article>
          <article>
            <span>NPS · primary</span>
            <strong>
              {analysis.nps}
              <small> / 10</small>
            </strong>
            <em className="meta">{analysis.npsBand}</em>
          </article>
          <article>
            <span>CSAT</span>
            <strong>
              {analysis.csat}
              <small> / 5</small>
            </strong>
            <em className="meta">{analysis.csatBand}</em>
          </article>
        </div>

        <section className={analysis.nba ? "nba" : "nba is-clear"} data-testid="detail-nba">
          <h3>Next best action</h3>
          {analysis.nba ? (
            <>
              <span className="status">{analysis.nba.statusLabel}</span>
              <p>
                <strong>{analysis.nba.title}.</strong> {analysis.nba.detail}
              </p>
              <p className="meta">Triggered when this transcript was scored. This is not a suggestion waiting on a click.</p>
              <dl>
                <dt>Reference</dt>
                <dd>{analysis.nba.reference}</dd>
                <dt>Team</dt>
                <dd>{analysis.nba.team}</dd>
                <dt>Owner</dt>
                <dd>{analysis.nba.owner}</dd>
                <dt>Status</dt>
                <dd>{analysis.nba.statusLabel}</dd>
              </dl>
            </>
          ) : (
            <p>
              No action triggered. NPS is {analysis.npsBand} and CSAT is {analysis.csatBand}. An action fires only when NPS is 0–6 or CSAT is 1–2.
            </p>
          )}
        </section>

        <section className="why">
          <h3>Why this score</h3>
          <p>{analysis.reason}</p>
          <blockquote>
            {analysis.quotes.map((quote) => (
              <p key={quote}>{quote}</p>
            ))}
          </blockquote>
        </section>

        <section className="transcript">
          <h3>Transcript</h3>
          <p className="meta">
            Excerpt from the customer, then the full call. Highlighted lines are the ones the score quotes. Audio is not transcribed here — this text was already produced.
          </p>
          <div className={`tag ${tone}`} style={{ margin: "8px 0 12px" }}>
            {transcript.topic}
          </div>
          {transcript.lines.map((line, index) => (
            <p key={`${transcript.id}-${index}`} className={line.speaker === "Customer" ? "line customer" : "line agent"}>
              <span className="who">{line.speaker}</span>
              {highlight(line.text, analysis.quotes)}
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}
