"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { analyzeTranscript, sentimentLabel } from "@/lib/analyze";
import { transcripts } from "@/lib/transcripts";
import type { Analysis, Channel, Transcript } from "@/lib/types";
import { CallDetail } from "./CallDetail";
import { ScoreChart } from "./NpsChart";
import { ScoreDial } from "./ScoreDial";
import { SiteHeader } from "./SiteHeader";

type Row = { transcript: Transcript; analysis: Analysis; order: number };

const STEP_MS = 3000;

function channelLabel(channel: Channel): string {
  if (channel === "email") return "Email";
  if (channel === "whatsapp") return "WhatsApp";
  return "Voice";
}

export function TranscriptDesk() {
  const params = useSearchParams();
  const requested = params.get("call");
  const [run, setRun] = useState(0);
  const openedRequest = useRef<string | null>(null);
  const [count, setCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      transcripts.map((transcript, order) => ({
        transcript,
        analysis: analyzeTranscript(transcript),
        order,
      })),
    [],
  );

  useEffect(() => {
    setCount(0);
    setSelectedId(null);
    const timers: number[] = [];
    let seen = 0;
    const tick = () => {
      seen += 1;
      setCount(seen);
      if (seen < rows.length) timers.push(window.setTimeout(tick, STEP_MS));
    };
    timers.push(window.setTimeout(tick, STEP_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [run, rows.length]);

  useEffect(() => {
    openedRequest.current = null;
  }, [run]);

  useEffect(() => {
    if (!requested || openedRequest.current === requested) return;
    const row = rows.find((item) => item.transcript.id === requested);
    if (!row || count <= row.order) return;
    openedRequest.current = requested;
    setSelectedId(requested);
  }, [requested, count, rows]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [selectedId]);

  const visible = rows.slice(0, count);
  const newestId = visible.at(-1)?.transcript.id;
  const actions = visible
    .filter((row) => row.analysis.nba)
    .slice()
    .sort((a, b) => a.analysis.nps - b.analysis.nps || a.analysis.csat - b.analysis.csat || a.order - b.order);
  const npsValues = visible.map((row) => row.analysis.nps);
  const csatValues = visible.map((row) => row.analysis.csat);
  const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const avgNps = avg(npsValues);
  const avgCsat = avg(csatValues);
  const channelCount = (channel: Channel) => visible.filter((row) => row.transcript.channel === channel).length;
  const voiceCount = channelCount("voice");
  const emailCount = channelCount("email");
  const whatsappCount = channelCount("whatsapp");
  const promoters = visible.filter((row) => row.analysis.npsBand === "promoter").length;
  const passives = visible.filter((row) => row.analysis.npsBand === "passive").length;
  const detractors = visible.filter((row) => row.analysis.npsBand === "detractor").length;
  const ingesting = count < rows.length;
  const selected = rows.find((row) => row.transcript.id === selectedId) ?? null;

  return (
    <>
      <SiteHeader current="desk">
        <span className="live-pill">
          <span className={ingesting ? "dot is-on" : "dot"} aria-hidden="true" />
          {count === 0
            ? "Waiting for the first interaction"
            : ingesting
              ? `Ingesting ${count} of ${rows.length}`
              : `Queue ingested · ${rows.length}`}
        </span>
        <button type="button" className="text-button" onClick={() => setRun((value) => value + 1)}>
          Replay
        </button>
      </SiteHeader>
      <main className="desk">
        <div className="wrap">
          <div className="desk-intro">
            <p className="kicker">NPS and CSAT · customer interactions support</p>
            <h1>Customer interactions support</h1>
            <p>
              Voice, email, and WhatsApp arrive one at a time, a few seconds apart. Each one is scored for NPS and CSAT. A negative score triggers a next best action — the action is already assigned, not merely suggested.
            </p>
          </div>

          <p className="status-strip">
            <span>
              Interactions <strong data-testid="kpi-count">{count}/{rows.length}</strong>
            </span>
            <span>
              Voice <strong data-testid="kpi-voice">{voiceCount}</strong>
            </span>
            <span>
              Email <strong data-testid="kpi-email">{emailCount}</strong>
            </span>
            <span>
              WhatsApp <strong data-testid="kpi-whatsapp">{whatsappCount}</strong>
            </span>
            <span>
              Actions triggered <strong data-testid="kpi-actions">{actions.length}</strong>
            </span>
            <span>
              Promoters <b>{promoters}</b> · Passives <b>{passives}</b> · Detractors <b>{detractors}</b>
            </span>
          </p>
          <div className="score-board">
            <section className="score-row" aria-label="NPS">
              <ScoreDial label="NPS" value={avgNps} min={0} max={10} caption="Running average · 0 to 10. Low is red, high is green." />
              <div className="panel">
                <div className="panel-head">
                  <h2>NPS as interactions arrive</h2>
                  <p data-testid="kpi-nps">{avgNps === null ? "Waiting" : `Average ${avgNps.toFixed(1)}`}</p>
                </div>
                {visible.length === 0 ? (
                  <p className="empty" style={{ padding: "16px" }}>The NPS line starts when the first interaction lands.</p>
                ) : (
                  <ScoreChart
                    label="NPS"
                    min={0}
                    max={10}
                    average={avgNps}
                    points={visible.map((row) => ({ value: row.analysis.nps, company: row.transcript.company }))}
                  />
                )}
              </div>
            </section>
            <section className="score-row" aria-label="CSAT">
              <ScoreDial label="CSAT" value={avgCsat} min={1} max={5} caption="Running average · 1 to 5. Its own dial, separate from NPS." />
              <div className="panel">
                <div className="panel-head">
                  <h2>CSAT as interactions arrive</h2>
                  <p data-testid="kpi-csat">{avgCsat === null ? "Waiting" : `Average ${avgCsat.toFixed(1)}`}</p>
                </div>
                {visible.length === 0 ? (
                  <p className="empty" style={{ padding: "16px" }}>The CSAT line starts when the first interaction lands.</p>
                ) : (
                  <ScoreChart
                    label="CSAT"
                    min={1}
                    max={5}
                    average={avgCsat}
                    points={visible.map((row) => ({ value: row.analysis.csat, company: row.transcript.company }))}
                  />
                )}
              </div>
            </section>
          </div>
          <p className="sr-only" aria-live="polite">
            {actions.length > 0
              ? `${actions.length} actions triggered. Lowest is ${actions[0].transcript.company}, NPS ${actions[0].analysis.nps}.`
              : count === rows.length
                ? "Queue ingested."
                : ""}
          </p>

          <div className="desk-grid">
            <div>
              <section className="panel" aria-label="Analyzed interactions">
                <div className="panel-head">
                  <h2>Analyzed interactions</h2>
                  <p>Newest first</p>
                </div>
                <div className="feed">
                  {visible.length === 0 ? <p className="empty">Interactions are about to arrive.</p> : null}
                  {visible
                    .slice()
                    .reverse()
                    .map((row) => (
                      <FeedButton
                        key={row.transcript.id}
                        row={row}
                        fresh={row.transcript.id === newestId && ingesting}
                        onOpen={() => setSelectedId(row.transcript.id)}
                      />
                    ))}
                </div>
              </section>
            </div>

            <aside className="panel actions" aria-label="Triggered actions">
              <div className="panel-head">
                <h2>Triggered actions</h2>
                <p>Click a case</p>
              </div>
              <div className="action-list">
                {actions.length === 0 ? (
                  <p className="empty">No negative scores yet. A case appears here when NPS is 0–6 or CSAT is 1–2.</p>
                ) : (
                  actions.map((row) => (
                    <button
                      key={row.transcript.id}
                      type="button"
                      className="action-hit"
                      data-testid="action-card"
                      data-company={row.transcript.company}
                      data-channel={row.transcript.channel}
                      onClick={() => setSelectedId(row.transcript.id)}
                    >
                      <strong>{row.transcript.company}</strong>
                      <span className="meta">{channelLabel(row.transcript.channel)} · {row.transcript.topic}</span>
                      <span className="row-tags">
                        <span className={`tag ${row.transcript.channel}`}>{channelLabel(row.transcript.channel)}</span>
                        <span className="tag neg">Negative</span>
                        <span className="tag score-pair">NPS {row.analysis.nps}</span>
                        <span className="tag score-pair">CSAT {row.analysis.csat}</span>
                        <span className="tag triggered">{row.analysis.nba?.statusLabel}</span>
                      </span>
                      <span className="quote-line">{row.analysis.nba?.summary}</span>
                      <span className="open-case">Open case</span>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
      {selected ? (
        <CallDetail
          transcript={selected.transcript}
          analysis={selected.analysis}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}

function FeedButton({ row, fresh, onOpen }: { row: Row; fresh: boolean; onOpen: () => void }) {
  const tone = row.analysis.sentiment === "negative" ? "neg" : row.analysis.sentiment === "mixed" ? "mix" : "pos";
  return (
    <button
      type="button"
      className={fresh ? "feed-hit is-new" : "feed-hit"}
      onClick={onOpen}
      data-company={row.transcript.company}
      data-channel={row.transcript.channel}
    >
      <strong>{row.transcript.company}</strong>
      <span className="meta">
        {row.transcript.callTime} · {row.transcript.queue} · {row.transcript.place}
      </span>
      <span className="meta">{row.transcript.topic}</span>
      <span className="score-lines">
        <span className={`tag ${row.transcript.channel}`} data-testid="channel-tag">{channelLabel(row.transcript.channel)}</span>
        <span className={`tag ${tone}`}>{sentimentLabel(row.analysis.sentiment)}</span>
        <span className="score-line">NPS {row.analysis.nps} · {row.analysis.npsBand}</span>
        <span className="score-line">CSAT {row.analysis.csat} · {row.analysis.csatBand}</span>
        {row.analysis.nba ? <span className="tag triggered">{row.analysis.nba.statusLabel}</span> : null}
      </span>
      {row.analysis.nba ? <span className="quote-line">{row.analysis.nba.summary}</span> : null}
    </button>
  );
}
