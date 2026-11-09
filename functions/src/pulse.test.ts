import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePulse, isResultBlob, pulseHttp, SITE_ORIGIN } from "./pulse";

test("an empty processed container is an empty pulse", () => {
  const pulse = aggregatePulse([]);
  assert.deepEqual(pulse, {
    total: 0,
    mix: { positive: 0, neutral: 0, negative: 0 },
    promoters: 0,
    detractors: 0,
    csat: null,
    reasons: [],
    evidence: null,
    movement: [],
  });
  assert.equal("nps" in pulse, false);
});

test("call results aggregate the pulse without a survey score", () => {
  const pulse = aggregatePulse([
    call({
      file: "later.json",
      sentiment: "negative",
      nps: null,
      npsBand: "detractor",
      reason: "They wanted to cancel",
      evidence: "I want to cancel.",
      scoredAt: "2026-11-08T12:00:00.000Z",
    }),
    call({
      file: "first.json",
      sentiment: "positive",
      nps: null,
      npsBand: "promoter",
      reason: "They were pleased with the call",
      evidence: "Thank you, that was excellent.",
      scoredAt: "2026-11-08T11:00:00.000Z",
    }),
    call({
      file: "again.json",
      sentiment: "negative",
      nps: null,
      npsBand: "detractor",
      reason: "They wanted to cancel",
      evidence: "Please cancel the cover.",
      scoredAt: "2026-11-08T13:00:00.000Z",
    }),
  ]);

  assert.equal(pulse.total, 3);
  assert.deepEqual(pulse.mix, { positive: 33, neutral: 0, negative: 67 });
  assert.equal(pulse.promoters, 1);
  assert.equal(pulse.detractors, 2);
  assert.deepEqual(pulse.reasons, [{ label: "They wanted to cancel", count: 2 }]);
  assert.deepEqual(pulse.evidence, { quote: "Please cancel the cover.", file: "again.json" });
  assert.deepEqual(
    pulse.movement.map((point) => point.file),
    ["first.json", "later.json", "again.json"],
  );
  assert.equal(pulse.movement[0]?.positive, 100);
  assert.equal(pulse.movement[0]?.negative, 0);
  assert.equal(pulse.movement[2]?.positive, 33);
  assert.equal(pulse.movement[2]?.negative, 67);
  assert.equal(JSON.stringify(pulse).includes("\"nps\""), false);
});

test("a real score still counts its band and is not returned as a survey number", () => {
  const pulse = aggregatePulse([
    call({
      file: "scored.txt",
      sentiment: "positive",
      nps: 10,
      npsBand: "promoter",
      reason: null,
      evidence: "Really pleased.",
      scoredAt: "2026-11-08T10:00:00.000Z",
    }),
  ]);
  assert.equal(pulse.promoters, 1);
  assert.equal(pulse.detractors, 0);
  assert.equal(pulse.evidence, null);
  assert.equal(JSON.stringify(pulse).includes("\"nps\""), false);
});

test("plain text with no band stays out of the promoter and detractor counts", () => {
  const pulse = aggregatePulse([
    call({
      file: "note.txt",
      sentiment: "mixed",
      nps: null,
      npsBand: null,
      reason: null,
      evidence: "Still cautious.",
      scoredAt: "2026-11-08T10:00:00.000Z",
    }),
  ]);
  assert.deepEqual(pulse.mix, { positive: 0, neutral: 100, negative: 0 });
  assert.equal(pulse.promoters, 0);
  assert.equal(pulse.detractors, 0);
  assert.deepEqual(pulse.reasons, []);
  assert.equal(pulse.evidence, null);
});

test("average csat is the mean of scored calls", () => {
  const pulse = aggregatePulse([
    { ...call({ file: "low.json", sentiment: "negative", nps: null, npsBand: "detractor", reason: "The problem was not resolved", evidence: "This is unresolved.", scoredAt: "2026-11-08T11:00:00.000Z" }), csat: 1 },
    { ...call({ file: "high.json", sentiment: "positive", nps: null, npsBand: "promoter", reason: "They were pleased with the call", evidence: "Excellent.", scoredAt: "2026-11-08T12:00:00.000Z" }), csat: 4 },
    call({ file: "old.json", sentiment: "mixed", nps: null, npsBand: null, reason: null, evidence: "Hello.", scoredAt: "2026-11-08T10:00:00.000Z" }),
  ]);
  assert.equal(pulse.csat, 2.5);
  assert.equal(pulse.total, 3);
  assert.equal("nps" in pulse, false);
});

test("result names are the JSON files under results, not the error files", () => {
  assert.equal(isResultBlob("results/life.json"), true);
  assert.equal(isResultBlob("results/life.json.error.json"), false);
  assert.equal(isResultBlob("life.json"), false);
});

test("the pulse route allows the static site and no other origin", () => {
  const response = pulseHttp("GET", []);
  assert.equal(response.status, 200);
  assert.equal(response.headers["Access-Control-Allow-Origin"], SITE_ORIGIN);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://sorted.trilogybpo.com");
  assert.equal(response.headers["Access-Control-Allow-Origin"]?.includes("*"), false);
  const preflight = pulseHttp("OPTIONS", []);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["Access-Control-Allow-Origin"], SITE_ORIGIN);
  assert.match(preflight.headers["Access-Control-Allow-Methods"] ?? "", /GET/);
});

function call(value: {
  file: string;
  sentiment: string;
  nps: number | null;
  npsBand: string | null;
  reason: string | null;
  evidence: string | null;
  scoredAt: string;
}) {
  return value;
}
