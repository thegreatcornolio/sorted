import Link from "next/link";
import { ReplayButton } from "@/components/ReplayButton";
import { SiteHeader } from "@/components/SiteHeader";

export default function ScoringPage() {
  return (
    <>
      <SiteHeader current="scoring">
        <ReplayButton />
      </SiteHeader>
      <article className="article">
        <p className="kicker">Score model</p>
        <h1>How an interaction becomes a score and an action</h1>
        <p className="muted">
          The desk reads interactions that already exist — voice, email, and WhatsApp — and quotes the customer lines that moved the score. NPS and CSAT each have their own dial and line. The dial colour moves from red through amber to green as the running average rises.
        </p>

        <h2>NPS, −100 to +100</h2>
        <p>
          Each interaction is still scored 0 to 10. Promoters are 9–10, passives are 7–8, and detractors are 0–6. The number on the overview is not an average of those scores. It is the share of promoters minus the share of detractors. Passives stay in the count, and they are not part of the subtraction.
        </p>
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
          Either a detractor NPS or a negative CSAT is enough. The action is specific to the lines that scored the interaction, and the status is already Escalated, Assigned, or Offer made.
        </p>
        <p>
          Example: Harper Stores says the bill arrived too late to pay, then the payments team sent a demand for payment. That interaction scores at the bottom of NPS and CSAT. Opening it shows the case was already escalated to the customer retentions team to apologize and offer a 1% rebate on the next bill.
        </p>
        <p>
          <Link href="/demo/interactions/?call=gl-1004" className="card-go">
            See Harper Stores on the interaction list
          </Link>
        </p>
      </article>
    </>
  );
}
