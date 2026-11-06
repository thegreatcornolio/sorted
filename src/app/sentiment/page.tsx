import type { Metadata } from "next";
import { SentimentPulseCard } from "@/components/SentimentPulseCard";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Sentiment Pulse · SORTED.AI",
  description:
    "Illustrative near-time sentiment and NPS across voice, email, and WhatsApp. Sample view, not live client data.",
};

const STEPS = [
  {
    n: "01",
    title: "Listen across channels",
    body: "Voice, email, and WhatsApp in one view.",
  },
  {
    n: "02",
    title: "Spot the shifts",
    body: "Positive and negative sentiment move across the week.",
  },
  {
    n: "03",
    title: "Follow the evidence",
    body: "Each shift points back to the customer line.",
  },
] as const;

export default function SentimentPage() {
  return (
    <div className="pulse-page">
      <SiteHeader current="sentiment">
        <span className="pulse-sample-pill">Illustrative sample</span>
      </SiteHeader>
      <main className="pulse">
        <section className="pulse-hero">
          <div className="wrap pulse-hero-grid">
            <div>
              <img className="trilogy-logo" src="/trilogy-logo.png" alt="Trilogy" width={4160} height={920} />
              <p className="pulse-kicker">Introducing a new customer signal</p>
              <h1>
                <span>Sentiment</span>
                <span className="pulse-accent">Pulse.</span>
              </h1>
              <p className="pulse-short">
                Hear how customers feel.
                <br />
                See what changes.
              </p>
              <p className="pulse-lede">Near-time sentiment and NPS across voice, email, and WhatsApp.</p>
              <p className="pulse-disclaimer">Illustrative sample. Not live client data.</p>
            </div>
            <SignalMark />
          </div>
        </section>

        <div className="wrap">
          <SentimentPulseCard />

          <ol className="pulse-steps">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="step-no">{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="pulse-foot">
            <span>SORTED.AI · Sentiment Pulse</span>
            <span>Illustrative sample · Not live client data</span>
          </p>
        </div>
      </main>
    </div>
  );
}

function SignalMark() {
  return (
    <div className="pulse-mark">
      <svg viewBox="0 0 320 280" aria-hidden="true">
        <circle cx="168" cy="132" r="118" fill="none" stroke="#61d779" strokeOpacity="0.35" strokeWidth="1.4" />
        <circle cx="168" cy="132" r="92" fill="none" stroke="#61d779" strokeOpacity="0.7" strokeWidth="1.4" />
        <circle cx="168" cy="132" r="66" fill="none" stroke="#1f6b34" strokeOpacity="0.28" strokeWidth="1.4" />
        <circle cx="168" cy="132" r="78" fill="#61d779" fillOpacity="0.09" />
        <circle cx="168" cy="14" r="6" fill="#61d779" />
        <circle cx="274" cy="74" r="5.5" fill="#d5ec67" />
        <circle cx="70" cy="206" r="5" fill="#c4922a" />
        <circle cx="250" cy="220" r="4.5" fill="#13202e" />
        <g transform="translate(102 78)">
          <rect x="0" y="0" width="132" height="90" rx="26" fill="#ffffff" stroke="#1f6b34" strokeWidth="2.75" />
          <path d="M46 88 L64 88 L54 110 Z" fill="#ffffff" stroke="#1f6b34" strokeWidth="2.75" strokeLinejoin="round" />
          <path d="M44 86 H68 V94 H44 Z" fill="#ffffff" />
          <polyline
            points="24,46 42,46 54,30 70,64 84,46 110,46"
            fill="none"
            stroke="#1f6b34"
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
