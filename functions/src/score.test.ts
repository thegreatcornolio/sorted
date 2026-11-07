import assert from "node:assert/strict";
import test from "node:test";
import { scoreTranscript } from "./score";

function score(text: string, file = "call.txt") {
  return scoreTranscript(file, Buffer.from(text));
}

test("plain text with no score derives sentiment and leaves NPS blank", () => {
  const result = score("Customer: The refund never arrived.\nAgent: I will look into that.");
  assert.equal(result.sentiment, "negative");
  assert.deepEqual(result.mix, { positive: 0, neutral: 0, negative: 100 });
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, null);
  assert.equal(result.reason, null);
  assert.equal(result.evidence, "The refund never arrived.");
  assert.equal(result.evidence?.includes("\n"), false);
});

test("a polite agent line does not override the customer", () => {
  const result = score("Agent: I am sorry about the refund.\nCustomer: Thank you, that was easy and I am really pleased.");
  assert.equal(result.sentiment, "positive");
  assert.deepEqual(result.mix, { positive: 100, neutral: 0, negative: 0 });
  assert.equal(result.evidence, "Thank you, that was easy and I am really pleased.");
  assert.equal(result.nps, null);
});

test("caution with no score stays mixed and does not invent NPS", () => {
  const result = score("I appreciate the update, though I am still cautious.");
  assert.equal(result.sentiment, "mixed");
  assert.deepEqual(result.mix, { positive: 0, neutral: 100, negative: 0 });
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, null);
  assert.equal(result.reason, null);
  assert.ok(result.evidence);
});

test("an NPS score sets promoter, passive, or detractor", () => {
  const bands: [string, string][] = [
    ["0", "detractor"],
    ["6", "detractor"],
    ["7", "passive"],
    ["8", "passive"],
    ["9", "promoter"],
    ["10", "promoter"],
  ];
  for (const [nps, band] of bands) {
    const result = score(`NPS: ${nps}\nCustomer: This is terrible and I am furious.`);
    assert.equal(result.nps, Number(nps));
    assert.equal(result.npsBand, band);
    assert.equal(result.sentiment, "negative");
  }
});

test("a detractor score adds one of the pulse reasons and one evidence line", () => {
  const cases: [string, string, string][] = [
    ["NPS: 3\nCustomer: The refund never arrived.", "A refund that is missing or short", "The refund never arrived."],
    [
      "Score: 1\nThe bill arrived too late to pay, then a demand for payment.",
      "A bill, fee, or charge that should not be there",
      "The bill arrived too late to pay, then a demand for payment.",
    ],
    ["NPS 2\nThe parcel arrived broken and three days late.", "Delivery was late, broken, or the wrong item", "The parcel arrived broken and three days late."],
    ["NPS: 4/10\nI was on hold for forty minutes and nobody called back.", "A long wait, a missed callback, or being passed around", "I was on hold for forty minutes and nobody called back."],
    [
      "score = 5\nI am locked out and the complaint was ignored.",
      "The account was locked, closed, or a complaint was ignored",
      "I am locked out and the complaint was ignored.",
    ],
    ["NPS: 1\nThis is terrible and I am furious.", "Something else went wrong", "This is terrible and I am furious."],
  ];
  for (const [text, reason, evidence] of cases) {
    const result = score(text);
    assert.equal(result.npsBand, "detractor");
    assert.equal(result.reason, reason);
    assert.equal(result.evidence, evidence);
  }
});

test("a promoter score does not invent a detractor reason", () => {
  const result = score("Company: Harper Stores\nNPS: 9\nCustomer: Really pleased, that was easy and I will shop again.");
  assert.equal(result.company, "Harper Stores");
  assert.equal(result.nps, 9);
  assert.equal(result.npsBand, "promoter");
  assert.equal(result.reason, null);
  assert.equal(result.sentiment, "positive");
  assert.equal(result.evidence, "Really pleased, that was easy and I will shop again.");
});

test("sentiment stays with the words when the score disagrees", () => {
  const result = score("NPS: 10\nCustomer: The refund never arrived.");
  assert.equal(result.npsBand, "promoter");
  assert.equal(result.sentiment, "negative");
  assert.equal(result.reason, null);
  assert.equal(result.mix.negative, 100);
});

test("JSON transcripts use a numeric score when one is present", () => {
  const withScore = score(
    JSON.stringify({
      company: "Harper Stores",
      nps: 3,
      lines: [
        { speaker: "Agent", text: "Thanks for calling." },
        { speaker: "Customer", text: "The refund never arrived." },
      ],
    }),
    "harper.json",
  );
  assert.equal(withScore.file, "harper.json");
  assert.equal(withScore.company, "Harper Stores");
  assert.equal(withScore.nps, 3);
  assert.equal(withScore.npsBand, "detractor");
  assert.equal(withScore.reason, "A refund that is missing or short");
  assert.equal(withScore.evidence, "The refund never arrived.");

  const plain = score(
    JSON.stringify({
      lines: [{ speaker: "Customer", text: "Really pleased and the delivery went smoothly." }],
    }),
  );
  assert.equal(plain.sentiment, "positive");
  assert.equal(plain.nps, null);
  assert.equal(plain.npsBand, null);
  assert.equal(plain.reason, null);
});

test("a text body inside JSON can carry the only score", () => {
  const result = score(JSON.stringify({ text: "NPS: 8\nThank you, that was easy." }));
  assert.equal(result.nps, 8);
  assert.equal(result.npsBand, "passive");
  assert.equal(result.reason, null);
  assert.equal(result.sentiment, "positive");
});

test("rejects an unusable file", () => {
  assert.throws(() => score("   \n"), /empty/i);
  assert.throws(() => score("NPS: 11\nThe refund never arrived."), /0 to 10/);
  assert.throws(() => score("NPS: 2\nNPS: 3\nThe refund never arrived."), /more than one score/);
  assert.throws(() => score("{"), /not valid JSON/i);
  assert.throws(() => score(JSON.stringify({ nps: 4.5, text: "The refund never arrived." })), /0 to 10/);
  assert.throws(() => scoreTranscript("blob.bin", Buffer.from([0x00, 0x61])), /not text/);
  assert.throws(() => scoreTranscript("huge.txt", Buffer.alloc(1_048_577, 65)), /too large/);
});
