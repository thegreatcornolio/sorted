import assert from "node:assert/strict";
import test from "node:test";
import { OPENAI_API_KEY, OPENAI_API_VERSION, OPENAI_DEPLOYMENT, OPENAI_ENDPOINT } from "./layout";
import {
  JUDGMENT_FIELDS,
  MODEL_CHARS,
  SCORE_INSTRUCTIONS,
  acceptJudgment,
  chatBody,
  chatUrl,
  clipForModel,
  judgeTranscript,
  openAISettings,
  safeErrorMessage,
} from "./openai";

const transcript = "The price is pure evil and there is no Saturday slot. All right, I'll see you tomorrow morning once the payment was successful.";

const booked = {
  predicted_nps: 9,
  nps_category: "promoter",
  sentiment_start: "negative",
  sentiment_end: "positive",
  resolved: true,
  csat: 4,
  primary_reason: "They booked and paid for the appointment.",
  evidence: "All right, I'll see you tomorrow morning once the payment was successful.",
  summary: "The caller disliked the price, then booked and paid.",
  vulnerable: false,
  vulnerability_reason: "",
  next_step: "",
};

function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    [OPENAI_ENDPOINT]: "https://sorted.openai.azure.com",
    [OPENAI_API_KEY]: "test-key-value",
    [OPENAI_DEPLOYMENT]: "score-calls",
    [OPENAI_API_VERSION]: "2024-10-21",
    ...overrides,
  };
}

test("the request asks for strict JSON and judges the whole call", () => {
  const body = chatBody(transcript);
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.deepEqual(body.response_format.json_schema.schema.required, [...JUDGMENT_FIELDS]);
  assert.equal(body.messages[0]?.content, SCORE_INSTRUCTIONS);
  assert.match(body.messages[0]?.content ?? "", /whole call/i);
  assert.match(body.messages[0]?.content ?? "", /weigh the ending/i);
  assert.match(body.messages[0]?.content ?? "", /booked, paid close is not a detractor/i);
  assert.match(body.messages[0]?.content ?? "", /predicted_nps is 9/);
  assert.match(body.messages[0]?.content ?? "", /csat is 4/);
  assert.match(body.messages[0]?.content ?? "", /"O\."/);
  assert.match(body.messages[0]?.content ?? "", /trouble paying/i);
  assert.match(body.messages[0]?.content ?? "", /late on payments/i);
  assert.match(body.messages[0]?.content ?? "", /change in circumstances/i);
  assert.match(body.messages[0]?.content ?? "", /ordinary price dislike/i);
  assert.match(body.messages[0]?.content ?? "", /I can't afford that/);
  assert.match(body.messages[0]?.content ?? "", /can still pay/);
  const properties = body.response_format.json_schema.schema.properties as Record<string, { type: string }>;
  assert.equal(properties.vulnerable?.type, "boolean");
  assert.equal(properties.vulnerability_reason?.type, "string");
  assert.equal(properties.next_step?.type, "string");
  assert.equal(body.messages[1]?.content, transcript);
  assert.equal(JSON.stringify(body).includes("test-key-value"), false);
});

test("a booked paid close maps to promoter 9 and csat 4", () => {
  const score = acceptJudgment(booked, transcript);
  assert.equal(score.predicted_nps, 9);
  assert.equal(score.nps_category, "promoter");
  assert.equal(score.csat, 4);
  assert.equal(score.resolved, true);
  assert.equal(score.sentiment_end, "positive");
  assert.equal(score.vulnerable, false);
  assert.equal(score.vulnerability_reason, "");
  assert.equal(score.next_step, "");
  assert.match(score.evidence, /see you tomorrow/i);
});

test("ordinary price dislike is not stored as vulnerable", () => {
  const score = acceptJudgment(
    {
      ...booked,
      vulnerability_reason: "They disliked the price.",
      next_step: "Apologise for the price.",
    },
    transcript,
  );
  assert.equal(score.vulnerable, false);
  assert.equal(score.vulnerability_reason, "");
  assert.equal(score.next_step, "");
});

test("a caller who cannot pay is vulnerable, with a reason and a next step", () => {
  const hardship = "I lost my job last month and I am two months late, so I cannot pay this bill.";
  const score = acceptJudgment(
    {
      ...booked,
      predicted_nps: 4,
      nps_category: "detractor",
      sentiment_start: "negative",
      sentiment_end: "negative",
      resolved: false,
      csat: 2,
      primary_reason: "They cannot pay after losing work.",
      evidence: hardship,
      summary: "The caller is late and cannot pay.",
      vulnerable: true,
      vulnerability_reason: "They lost their job and are two months late, so they cannot pay.",
      next_step: "Offer a payment plan and a hardship callback.",
    },
    hardship,
  );
  assert.equal(score.vulnerable, true);
  assert.equal(score.vulnerability_reason, "They lost their job and are two months late, so they cannot pay.");
  assert.equal(score.next_step, "Offer a payment plan and a hardship callback.");
  assert.equal(score.predicted_nps, 4);
  assert.equal(score.csat, 2);
  assert.throws(
    () => acceptJudgment({ ...booked, vulnerable: true, vulnerability_reason: "", next_step: "Call them back." }, transcript),
    /reason and a next step/,
  );
  assert.throws(
    () => acceptJudgment({ ...booked, vulnerable: true, vulnerability_reason: "They cannot pay.", next_step: "  " }, transcript),
    /reason and a next step/,
  );
});

test("a caller who cannot afford the service is vulnerable even when the model says no", () => {
  const quote = "Oh, I can't afford that. If he can't take mine, I can't afford that.";
  const score = acceptJudgment(
    {
      ...booked,
      predicted_nps: 2,
      nps_category: "detractor",
      sentiment_start: "negative",
      sentiment_end: "negative",
      resolved: false,
      csat: 2,
      primary_reason: "Caller could not afford the suggested service.",
      evidence: quote,
      summary: "The caller could not afford the service.",
      vulnerable: false,
      vulnerability_reason: "",
      next_step: "",
    },
    quote,
  );
  assert.equal(score.predicted_nps, 2);
  assert.equal(score.nps_category, "detractor");
  assert.equal(score.csat, 2);
  assert.equal(score.vulnerable, true);
  assert.equal(score.vulnerability_reason, "Caller could not afford the suggested service.");
  assert.match(score.next_step, /payment plan/i);
});

test("the model JSON is rejected when it disagrees with itself or quotes a fragment", () => {
  assert.throws(() => acceptJudgment({ ...booked, nps_category: "detractor" }, transcript), /NPS band/);
  assert.throws(() => acceptJudgment({ ...booked, predicted_nps: 11 }, transcript), /0 to 10/);
  assert.throws(() => acceptJudgment({ ...booked, csat: 1 }, transcript), /CSAT/);
  assert.throws(() => acceptJudgment({ ...booked, evidence: "O." }, transcript), /not a sentence/);
  assert.throws(() => acceptJudgment({ ...booked, evidence: "Yes." }, transcript), /not a sentence/);
  assert.throws(() => acceptJudgment({ ...booked, evidence: "Really pleased." }, "Really pleased."), /not a sentence/);
  assert.throws(() => acceptJudgment({ ...booked, evidence: "The caller was happy." }, transcript), /not a sentence/);
  assert.throws(() => acceptJudgment({ ...booked, extra: true }, transcript), /unexpected field/);
  assert.throws(() => acceptJudgment(JSON.parse('{"predicted_nps":9}'), transcript), /unexpected field/);
});

test("each Azure OpenAI setting is required and the key stays out of the URL", () => {
  for (const name of [OPENAI_ENDPOINT, OPENAI_API_KEY, OPENAI_DEPLOYMENT, OPENAI_API_VERSION]) {
    assert.throws(() => openAISettings(env({ [name]: "  " })), new RegExp(`${name} is not set`));
  }
  assert.throws(() => openAISettings(env({ [OPENAI_ENDPOINT]: "http://sorted.openai.azure.com" })), /not a URL/);
  const settings = openAISettings(env());
  const url = chatUrl(settings);
  assert.equal(url, "https://sorted.openai.azure.com/openai/deployments/score-calls/chat/completions?api-version=2024-10-21");
  assert.equal(url.includes(settings.apiKey), false);
});

test("the live call posts the transcript and returns the strict score", async () => {
  let seen: { url: string; key: string; body: string } | undefined;
  const score = await judgeTranscript(transcript, env(), async (input, init) => {
    const headers = new Headers(init?.headers);
    seen = { url: String(input), key: headers.get("api-key") ?? "", body: String(init?.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(booked) } }] }), { status: 200 });
  });
  assert.equal(score.nps_category, "promoter");
  assert.equal(score.csat, 4);
  assert.equal(score.vulnerable, false);
  assert.equal(score.vulnerability_reason, "");
  assert.equal(score.next_step, "");
  assert.equal(seen?.url, chatUrl(openAISettings(env())));
  assert.equal(seen?.key, "test-key-value");
  assert.equal(seen?.body.includes("test-key-value"), false);
  assert.match(seen?.body ?? "", /"strict":true/);
});

test("a failed model response does not repeat the API key", async () => {
  await assert.rejects(
    () =>
      judgeTranscript(transcript, env(), async () => new Response(JSON.stringify({ error: "bad test-key-value" }), { status: 401 })),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      assert.equal(message.includes("test-key-value"), false);
      assert.match(message, /failed \(401\)/);
      return true;
    },
  );
  assert.equal(safeErrorMessage(new Error("api-key: test-key-value")), "Scoring failed.");
});

test("a long transcript keeps the ending for the model", () => {
  const ending = "All right, I'll see you tomorrow morning once the payment was successful.";
  const text = `${"price ".repeat(30_000)}${ending}`;
  assert.ok(text.length > MODEL_CHARS);
  const clipped = clipForModel(text);
  assert.ok(clipped.length <= MODEL_CHARS);
  assert.match(clipped, /middle of the call is omitted/);
  assert.ok(clipped.endsWith(ending));
});
