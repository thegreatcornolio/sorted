"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { companyNps, sentimentLabel } from "@/lib/analyze";
import { useIngest } from "@/lib/ingest";
import { allRows } from "@/lib/rows";
import type { Channel } from "@/lib/types";
import { CallDetail } from "./CallDetail";
import { ScoreChart } from "./NpsChart";
import { SiteHeader } from "./SiteHeader";

function channelLabel(channel: Channel): string {
  if (channel === "email") return "Email";
  if (channel === "whatsapp") return "WhatsApp";
  return "Voice";
}

export function TranscriptDesk() {
  const params = useSearchParams();
  const requested = params.get("call");
  const openedRequest = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => allRows(), []);
  const { count, replay, epoch } = useIngest(rows.length);
  const visible = rows.slice(0, count);
  const newestId = visible.at(-1)?.transcript.id;
  const csatValues = visible.map((row) => row.analysis.csat);
  const avgCsat = csatValues.length ? csatValues.reduce((sum, value) => sum + value, 0) / csatValues.length : null;
  const npsPoints = visible.map((row, index) => ({
    value: companyNps(visible.slice(0, index + 1).map((item) => item.analysis.nps)) ?? 0,
    company: row.transcript.company,
  }));
  const npsNow = npsPoints.at(-1)?.value ?? null;
  const ingesting = count < rows.length;
  const selected = rows.find((row) => row.transcript.id === selectedId) ?? null;

  useEffect(() => {
    openedRequest.current = null;
    setSelectedId(null);
  }, [epoch]);

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

  return (
    <>
      <SiteHeader current="interactions">
        <span className="live-pill">
          <span className={ingesting ? "dot is-on" : "dot"} aria-hidden="true" />
          {count === 0 ? "Waiting for the first interaction" : ingesting ? `Ingesting ${count} of ${rows.length}` : `Queue ingested · ${rows.length}`}
        </span>
        <button type="button" className="text-button" onClick={replay}>
          Replay
        </button>
      </SiteHeader>
      <main className="desk">
        <div className="wrap">
          <div className="desk-intro">
            <p className="kicker">Voice · email · WhatsApp</p>
            <h1>Interactions</h1>
            <p>
              This is where the hundred interactions are processed, one every few seconds. The{" "}
              <Link href="/">overview</Link> uses this same queue for NPS, CSAT, and the top reasons.
            </p>
          </div>
          <div className="score-board">
            <section className="panel" aria-label="NPS over time">
              <div className="panel-head">
                <h2>NPS as interactions arrive</h2>
                <p data-testid="kpi-nps">{npsNow === null ? "Waiting" : `NPS ${npsNow > 0 ? "+" : ""}${npsNow}`}</p>
              </div>
              {visible.length === 0 ? (
                <p className="empty">The NPS line starts when the first interaction lands.</p>
              ) : (
                <ScoreChart
                  label="NPS"
                  min={-100}
                  max={100}
                  ticks={[-100, -50, 0, 50, 100]}
                  average={npsNow}
                  showRunningAverage={false}
                  note="Running NPS after each interaction · −100 to +100"
                  points={npsPoints}
                />
              )}
            </section>
            <section className="panel" aria-label="CSAT over time">
              <div className="panel-head">
                <h2>CSAT as interactions arrive</h2>
                <p data-testid="kpi-csat">{avgCsat === null ? "Waiting" : `Average ${avgCsat.toFixed(1)}`}</p>
              </div>
              {visible.length === 0 ? (
                <p className="empty">The CSAT line starts when the first interaction lands.</p>
              ) : (
                <ScoreChart
                  label="CSAT"
                  min={1}
                  max={5}
                  ticks={[1, 2, 3, 4, 5]}
                  average={avgCsat}
                  points={visible.map((row) => ({ value: row.analysis.csat, company: row.transcript.company }))}
                />
              )}
            </section>
          </div>
          <section className="panel" aria-label="Analyzed interactions">
            <div className="panel-head">
              <h2>Each interaction</h2>
              <p data-testid="kpi-count">
                {count}/{rows.length} · newest first
              </p>
            </div>
            <div className="feed">
              {visible.length === 0 ? <p className="empty">Interactions are about to arrive.</p> : null}
              {visible
                .slice()
                .reverse()
                .map((row) => {
                  const tone = row.analysis.sentiment === "negative" ? "neg" : row.analysis.sentiment === "mixed" ? "mix" : "pos";
                  return (
                    <button
                      key={row.transcript.id}
                      type="button"
                      className={row.transcript.id === newestId && ingesting ? "feed-hit is-new" : "feed-hit"}
                      data-company={row.transcript.company}
                      data-channel={row.transcript.channel}
                      onClick={() => setSelectedId(row.transcript.id)}
                    >
                      <strong>{row.transcript.company}</strong>
                      <span className="meta">
                        {channelLabel(row.transcript.channel)} · {row.transcript.callTime} · {row.transcript.queue}
                      </span>
                      <span className="score-lines">
                        <span className={`tag ${row.transcript.channel}`} data-testid="channel-tag">
                          {channelLabel(row.transcript.channel)}
                        </span>
                        <span className={`tag ${tone}`}>{sentimentLabel(row.analysis.sentiment)}</span>
                        <span className="score-line">
                          Score {row.analysis.nps} · {row.analysis.npsBand}
                        </span>
                        <span className="score-line">
                          CSAT {row.analysis.csat} · {row.analysis.csatBand}
                        </span>
                        {row.analysis.nba ? <span className="tag triggered">{row.analysis.nba.statusLabel}</span> : null}
                      </span>
                      <span className="reason-copy">{row.analysis.reason}</span>
                      <span className="quote-line">
                        {row.analysis.nba ? row.analysis.nba.summary : "No next best action. The score is not negative."}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        </div>
      </main>
      {selected ? (
        <CallDetail transcript={selected.transcript} analysis={selected.analysis} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  );
}
