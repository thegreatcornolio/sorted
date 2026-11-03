"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { analyzeTranscript, sentimentLabel } from "@/lib/analyze";
import { transcripts } from "@/lib/transcripts";
import type { Analysis } from "@/lib/types";
import type { Transcript } from "@/lib/types";
import { CallDetail } from "./CallDetail";
import { NpsChart } from "./NpsChart";
import { SiteHeader } from "./SiteHeader";

type Row = { transcript: Transcript; analysis: Analysis; order: number };

const STEP_MS = 260;

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
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = reduce ? 40 : STEP_MS;
    const timers: number[] = [];
    let seen = 0;
    const tick = () => {
      seen += 1;
      setCount(seen);
      if (seen < rows.length) timers.push(window.setTimeout(tick, step));
    };
    timers.push(window.setTimeout(tick, reduce ? 40 : 350));
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
            ? "Waiting for the first transcript"
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
            <p className="kicker">Gridline Business Fiber · sales and support</p>
            <h1>Transcript desk</h1>
            <p>
              This morning&apos;s call transcripts stream in as already-written text. Each one is scored for sentiment, NPS, and CSAT. A negative NPS or CSAT triggers a next best action — the action is already assigned, not merely suggested.
            </p>
          </div>

          <section className="kpis" aria-label="Live scores">
            <article className="kpi">
              <span>Transcripts</span>
              <strong data-testid="kpi-count">
                {count}
                <small>/{rows.length}</small>
              </strong>
              <em>Arriving now</em>
            </article>
            <article className="kpi">
              <span>Average NPS</span>
              <strong data-testid="kpi-nps">{avgNps === null ? "—" : avgNps.toFixed(1)}</strong>
              <em>Primary chart · 0–10</em>
            </article>
            <article className="kpi">
              <span>Average CSAT</span>
              <strong data-testid="kpi-csat">{avgCsat === null ? "—" : avgCsat.toFixed(1)}</strong>
              <em>1–5, beside every call</em>
            </article>
            <article className="kpi">
              <span>Actions triggered</span>
              <strong data-testid="kpi-actions">{actions.length}</strong>
              <em>Negative NPS or CSAT</em>
            </article>
          </section>
          <p className="bands">
            Promoters <b>{promoters}</b> · Passives <b>{passives}</b> · Detractors <b>{detractors}</b>
          </p>
          <p className="sr-only" aria-live="polite">
            {actions.length > 0
              ? `${actions.length} actions triggered. Lowest is ${actions[0].transcript.company}, NPS ${actions[0].analysis.nps}.`
              : count === rows.length
                ? "Queue ingested."
                : ""}
          </p>

          <div className="desk-grid">
            <div>
              <section className="panel" aria-label="NPS chart">
                <div className="panel-head">
                  <h2>NPS as calls arrive</h2>
                  <p>Primary live score · 0 to 10</p>
                </div>
                {visible.length === 0 ? (
                  <p className="empty" style={{ padding: "16px" }}>
                    Scores plot as each transcript lands.
                  </p>
                ) : (
                  <NpsChart
                    points={visible.map((row) => ({ nps: row.analysis.nps, company: row.transcript.company }))}
                    average={avgNps}
                  />
                )}
                <div className="legend">
                  <span><i className="swatch promoter" /> Promoter 9–10</span>
                  <span><i className="swatch passive" /> Passive 7–8</span>
                  <span><i className="swatch detractor" /> Detractor 0–6</span>
                  <span><i className="swatch avg" /> Running average</span>
                </div>
              </section>

              <section className="panel" style={{ marginTop: 16 }} aria-label="Analyzed calls">
                <div className="panel-head">
                  <h2>Analyzed calls</h2>
                  <p>Newest first</p>
                </div>
                <div className="feed">
                  {visible.length === 0 ? <p className="empty">The queue is about to start.</p> : null}
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
                      onClick={() => setSelectedId(row.transcript.id)}
                    >
                      <strong>{row.transcript.company}</strong>
                      <span className="meta">{row.transcript.topic}</span>
                      <span className="row-tags">
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
    >
      <strong>{row.transcript.company}</strong>
      <span className="meta">
        {row.transcript.callTime} · {row.transcript.queue} · {row.transcript.circuit}
      </span>
      <span className="meta">{row.transcript.topic}</span>
      <span className="row-tags">
        <span className={`tag ${tone}`}>{sentimentLabel(row.analysis.sentiment)}</span>
        <span className="tag score-pair">NPS {row.analysis.nps}</span>
        <span className="tag score-pair">CSAT {row.analysis.csat}</span>
        {row.analysis.nba ? <span className="tag triggered">{row.analysis.nba.statusLabel}</span> : null}
      </span>
      {row.analysis.nba ? <span className="quote-line">{row.analysis.nba.summary}</span> : null}
    </button>
  );
}
