import { app, type HttpRequest, type HttpResponseInit, type InvocationContext, type Timer } from "@azure/functions";
import { scoreIncomingFromEnv } from "./azure";

export async function scoreIncomingTimer(_timer: Timer, context: InvocationContext): Promise<void> {
  const summary = await scoreIncomingFromEnv();
  context.log(JSON.stringify(summary));
}

export async function scoreIncomingHttp(_request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const summary = await scoreIncomingFromEnv();
  context.log(JSON.stringify(summary));
  return { jsonBody: summary };
}

app.timer("scoreIncoming", {
  schedule: "0 * * * * *",
  runOnStartup: true,
  handler: scoreIncomingTimer,
});

app.http("scoreIncomingNow", {
  route: "score-transcripts",
  methods: ["POST"],
  authLevel: "function",
  handler: scoreIncomingHttp,
});
