import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function ScoringPage() {
  return (
    <>
      <SiteHeader current="scoring" />
      <article className="article">
        <p className="kicker">Score model</p>
        <h1>How a transcript becomes a score and an action</h1>
        <p className="muted">
          The desk does not transcribe audio. It reads a transcript that already exists and quotes the customer lines that moved the score. NPS is the number on the live chart. CSAT is shown on every call and in the average.
        </p>

        <h2>NPS, 0 to 10</h2>
        <p>One number per call, not a company-wide index. The chart plots that number in arrival order and a running average.</p>
        <table className="table">
          <thead>
            <tr>
              <th>Band</th>
              <th>Score</th>
              <th>Meaning on this desk</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Promoter</td>
              <td>9–10</td>
              <td>The customer describes a clean outcome in their own words.</td>
            </tr>
            <tr>
              <td>Passive</td>
              <td>7–8</td>
              <td>Fine, or fine with a reservation that does not yet need an action.</td>
            </tr>
            <tr>
              <td>Detractor</td>
              <td>0–6</td>
              <td>Negative. A next best action is triggered.</td>
            </tr>
          </tbody>
        </table>

        <h2>CSAT, 1 to 5</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Band</th>
              <th>Score</th>
              <th>Meaning on this desk</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Positive</td>
              <td>4–5</td>
              <td>The interaction itself landed well.</td>
            </tr>
            <tr>
              <td>Neutral</td>
              <td>3</td>
              <td>Handled, with something still unresolved in tone or follow-up.</td>
            </tr>
            <tr>
              <td>Negative</td>
              <td>1–2</td>
              <td>Negative. A next best action is triggered even if you only watch CSAT.</td>
            </tr>
          </tbody>
        </table>

        <h2>When an action fires</h2>
        <p>
          Either a detractor NPS or a negative CSAT is enough. The action is specific to the lines that scored the call, and the status is already Escalated, Assigned, or Offer made.
        </p>
        <p>
          Example: a logistics accounts payable manager says the statement arrived too late to pay, then credit control sent a demand for payment. That call scores at the bottom of NPS and CSAT. Opening it shows the case was escalated to the customer retentions team to call, apologize, and offer a 1% rebate on the next bill.
        </p>
        <p>
          <Link href="/nadclinic" className="card-go">
            Watch it on the transcript desk
          </Link>
        </p>
      </article>
    </>
  );
}
