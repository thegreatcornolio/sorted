import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TRANSCRIPT_BYTES } from "./layout";
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
  assert.throws(() => scoreTranscript("huge.txt", Buffer.alloc(MAX_TRANSCRIPT_BYTES + 1, 65)), /too large/);
});

test("an AssemblyAI call is scored from what was said, not from confidence", () => {
  const text = "I want to cancel. The premium is too expensive.";
  const result = score(JSON.stringify(asr(text, 9)), "life.json");
  assert.equal(result.file, "life.json");
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, "detractor");
  assert.equal(result.reason, "They wanted to cancel");
  assert.ok(result.evidence);
  assert.equal(text.includes(result.evidence), true);
  assert.ok(result.evidence.length <= 280);
  assert.equal(result.evidence.includes("\n"), false);
});

test("a pleased call is a promoter without a survey score", () => {
  const text = "Thank you, that was excellent and I am really pleased.";
  const result = score(JSON.stringify(asr(text, 0.99)));
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, "promoter");
  assert.equal(result.reason, "They were pleased with the call");
  assert.equal(text.includes(result.evidence ?? ""), true);
  assert.ok((result.evidence ?? "").length <= 280);
});

test("an undecided call is passive without a survey score", () => {
  const text = "I will think about it. I am still deciding.";
  const result = score(JSON.stringify(asr(text, 0.8)));
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, "passive");
  assert.equal(result.csat, 3);
  assert.equal(result.csatBand, "neutral");
  assert.equal(result.reason, "They were still deciding");
  assert.equal(text.includes(result.evidence ?? ""), true);
});

test("a frustrated or unresolved call is a detractor with low csat", () => {
  const text = "Thank you for calling. Have a great day. I am frustrated. This is still unresolved and nobody called me back.";
  const result = score(JSON.stringify(asr(text, 0.91)));
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, "detractor");
  assert.equal(result.sentiment, "negative");
  assert.ok(result.csat <= 2);
  assert.equal(result.csatBand, "negative");
  assert.equal(result.reason, "The problem was not resolved");
  assert.equal(text.includes(result.evidence ?? ""), true);
});

test("a call with no clear outcome is a detractor, not passive", () => {
  const text = "Thank you for calling. Have a great day. The policy documents are in the post.";
  const result = score(JSON.stringify(asr(text, 0.9)));
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, "detractor");
  assert.equal(result.sentiment, "negative");
  assert.ok(result.csat <= 2);
  assert.equal(result.csatBand, "negative");
});

test("agent filler is not a promoter and mild complaints are detractors", () => {
  const batch: [string, string][] = [
    ["Thank you for calling. I'll go ahead and update that. Perfect. That sounds good.", "detractor"],
    ["I've got a problem with the payment. The bill doesn't look right.", "detractor"],
    ["No, I don't want the cover.", "detractor"],
    ["I was on hold and nobody came back to me.", "detractor"],
    ["Please cancel it. I'm a bit unhappy about the charge.", "detractor"],
    ["I will think about it. I am still deciding.", "passive"],
    ["Thank you, that was excellent and I am really pleased.", "promoter"],
  ];
  const bands = batch.map(([text]) => score(JSON.stringify(asr(text, 0.9))).npsBand);
  assert.deepEqual(bands, batch.map(([, band]) => band));
  assert.ok(bands.includes("detractor"));
  for (const [text, band] of batch) {
    const result = score(JSON.stringify(asr(text, 0.9)));
    assert.equal(result.nps, null);
    if (band === "detractor") {
      assert.ok(result.csat <= 2);
      assert.equal(result.csatBand, "negative");
      assert.equal(result.sentiment, "negative");
    }
    if (band === "promoter") assert.ok(result.csat >= 4);
    if (band === "passive") assert.equal(result.csat, 3);
    assert.equal(text.includes(result.evidence ?? ""), true);
  }
});

test("a clearly pleased call keeps a high csat", () => {
  const text = "Thank you, that was excellent and I am really pleased.";
  const result = score(JSON.stringify(asr(text, 0.99)), "pleased.json");
  assert.equal(result.npsBand, "promoter");
  assert.ok(result.csat >= 4);
  assert.equal(result.csatBand, "positive");
});

test("a call larger than one megabyte still scores", () => {
  const text = "I want to cancel. The premium is too expensive.";
  const call = asr(text, 0.93);
  const sample = Buffer.byteLength(JSON.stringify({ text: "um", start: 0, end: 40, confidence: 0.4, speaker: null }));
  const extra = Math.ceil((1_048_577 - Buffer.byteLength(JSON.stringify(call))) / sample) + 8;
  for (let index = 0; index < extra; index += 1) {
    call.words.push({ text: "um", start: index * 100, end: index * 100 + 40, confidence: 0.4, speaker: null });
  }
  const body = Buffer.from(JSON.stringify(call));
  assert.ok(body.length > 1_048_576);
  assert.ok(body.length <= MAX_TRANSCRIPT_BYTES);
  const result = scoreTranscript("life-long.json", body);
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, "detractor");
  assert.equal(result.reason, "They wanted to cancel");
  assert.equal(text.includes(result.evidence ?? ""), true);
});

function asr(text: string, confidence: number) {
  return {
    text,
    confidence,
    audio_duration: 146.2,
    words: text.split(/\s+/).map((word, index) => ({
      text: word,
      start: index * 400,
      end: index * 400 + 280,
      confidence: 0.88,
      speaker: null as null,
    })),
    redacted_pii_policies: ["person_name", "phone_number"],
  };
}
