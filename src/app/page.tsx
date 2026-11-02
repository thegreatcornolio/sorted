import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <section className="hero">
        <div className="wrap">
          <p className="kicker">Demos</p>
          <h1>
            Scores from the calls you already <span>have</span>
          </h1>
          <p className="lede">
            SORTED reads finished transcripts for a business-fiber sales and support desk. It does not transcribe audio. Sentiment, NPS, and CSAT update as each transcript lands, and a poor score triggers the next action.
          </p>
        </div>
      </section>
      <main className="page">
        <div className="wrap">
          <div className="card-grid">
            <Link href="/nadclinic" className="demo-card">
              <span className="eyebrow">Live desk</span>
              <h2 className="card-title">Fiber transcript desk</h2>
              <p>
                About thirty business-fiber calls stream in. Watch NPS move, then open a negative case — the retentions action is already triggered.
              </p>
              <span className="card-go">Open the desk</span>
            </Link>
            <Link href="/scoring" className="demo-card">
              <span className="eyebrow">How to read it</span>
              <h2 className="card-title">Score model</h2>
              <p>
                NPS and CSAT side by side, which band counts as negative, and when a next best action fires on its own.
              </p>
              <span className="card-go">Read the model</span>
            </Link>
          </div>
          <p className="note">
            Accounts, circuits, and dialogue are fictional. The desk quotes the customer line that produced each score.
          </p>
        </div>
      </main>
    </>
  );
}
