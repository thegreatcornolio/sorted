import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TRANSCRIPT_BYTES } from "./layout";
import type { CallJudgment } from "./openai";
import { scoreTranscript } from "./score";

function judgment(overrides: Partial<CallJudgment> = {}): CallJudgment {
  return {
    predicted_nps: 9,
    nps_category: "promoter",
    sentiment_start: "negative",
    sentiment_end: "positive",
    resolved: true,
    csat: 4,
    primary_reason: "They booked and paid for the appointment.",
    evidence: "All right, I'll see you tomorrow morning once the payment was successful.",
    summary: "The caller disliked the price, then booked and paid.",
    ...overrides,
  };
}

test("a booked and paid close is a promoter with csat 4", async () => {
  const text = "The price is pure evil and there is no Saturday slot. All right, I'll see you tomorrow morning once the payment was successful.";
  let seen = "";
  const result = await scoreTranscript("windshield.txt", Buffer.from(JSON.stringify(asr(text, 0.92))), async (transcript) => {
    seen = transcript;
    return judgment();
  });
  assert.equal(seen, text);
  assert.equal(seen.includes("confidence"), false);
  assert.equal(result.file, "windshield.txt");
  assert.equal(result.nps, null);
  assert.equal(result.predictedNps, 9);
  assert.equal(result.npsBand, "promoter");
  assert.equal(result.csat, 4);
  assert.equal(result.csatBand, "positive");
  assert.equal(result.sentiment, "positive");
  assert.equal(result.sentimentStart, "negative");
  assert.equal(result.sentimentEnd, "positive");
  assert.equal(result.resolved, true);
  assert.equal(result.reason, "They booked and paid for the appointment.");
  assert.equal(result.evidence === "O." || result.evidence === "Yes." || result.evidence === "Okay.", false);
  assert.ok(result.evidence.split(/\s+/).length >= 4);
  assert.equal(text.includes(result.evidence), true);
  assert.match(result.evidence, /see you tomorrow/i);
  assert.deepEqual(result.mix, { positive: 100, neutral: 0, negative: 0 });
});

test("an unresolved cancellation stays a detractor with low csat", async () => {
  const text = "I'll see you tomorrow. Actually, cancel it. I don't want this at all.";
  const result = await scoreTranscript("cancel.json", Buffer.from(JSON.stringify(asr(text, 9))), async (transcript) => {
    assert.equal(transcript, text);
    assert.equal(transcript.includes('"confidence"'), false);
    return judgment({
      predicted_nps: 2,
      nps_category: "detractor",
      sentiment_start: "positive",
      sentiment_end: "negative",
      resolved: false,
      csat: 1,
      primary_reason: "They cancelled and did not want the visit.",
      evidence: "I don't want this at all.",
      summary: "The caller cancelled after a promised visit.",
    });
  });
  assert.equal(result.nps, null);
  assert.equal(result.predictedNps, 2);
  assert.equal(result.npsBand, "detractor");
  assert.equal(result.csat, 1);
  assert.equal(result.csatBand, "negative");
  assert.equal(result.sentiment, "negative");
  assert.equal(result.resolved, false);
  assert.equal(text.includes(result.evidence), true);
});

test("a survey number is kept and the band still comes from the model", async () => {
  const result = await scoreTranscript(
    "harper.txt",
    Buffer.from("Company: Harper Stores\nNPS: 9\nCustomer: Really pleased with the visit today."),
    async (transcript) => {
      assert.equal(transcript.includes("NPS"), false);
      assert.equal(transcript.includes("Harper"), false);
      assert.match(transcript, /Really pleased with the visit today/);
      return judgment({
        evidence: "Really pleased with the visit today.",
        summary: "The caller was pleased.",
        sentiment_start: "positive",
      });
    },
  );
  assert.equal(result.company, "Harper Stores");
  assert.equal(result.nps, 9);
  assert.equal(result.predictedNps, 9);
  assert.equal(result.npsBand, "promoter");
  assert.equal(result.evidence, "Really pleased with the visit today.");
});

test("a fragment quote is rejected before it can be stored", async () => {
  const text = "All right, I'll see you tomorrow morning once the payment was successful.";
  await assert.rejects(
    () => scoreTranscript("windshield.txt", Buffer.from(text), async () => judgment({ evidence: "O." })),
    /not a sentence/,
  );
});

test("rejects an unusable file before calling the model", async () => {
  let called = false;
  const judge = async () => {
    called = true;
    return judgment();
  };
  await assert.rejects(() => scoreTranscript("blank.txt", Buffer.from("   \n"), judge), /empty/i);
  await assert.rejects(() => scoreTranscript("bad.txt", Buffer.from("NPS: 11\nThe refund never arrived today."), judge), /0 to 10/);
  await assert.rejects(() => scoreTranscript("two.txt", Buffer.from("NPS: 2\nNPS: 3\nThe refund never arrived today."), judge), /more than one score/);
  await assert.rejects(() => scoreTranscript("broken.json", Buffer.from("{"), judge), /not valid JSON/i);
  await assert.rejects(
    () => scoreTranscript("float.json", Buffer.from(JSON.stringify({ nps: 4.5, text: "The refund never arrived today." })), judge),
    /0 to 10/,
  );
  await assert.rejects(() => scoreTranscript("blob.bin", Buffer.from([0x00, 0x61]), judge), /not text/);
  await assert.rejects(() => scoreTranscript("huge.txt", Buffer.alloc(MAX_TRANSCRIPT_BYTES + 1, 65), judge), /too large/);
  assert.equal(called, false);
});

test("a call larger than one megabyte sends the spoken text, not the word list", async () => {
  const text = "I want to cancel this cover today because it costs too much.";
  const call = asr(text, 0.93);
  const sample = Buffer.byteLength(JSON.stringify({ text: "um", start: 0, end: 40, confidence: 0.4, speaker: null }));
  const extra = Math.ceil((1_048_577 - Buffer.byteLength(JSON.stringify(call))) / sample) + 8;
  for (let index = 0; index < extra; index += 1) {
    call.words.push({ text: "um", start: index * 100, end: index * 100 + 40, confidence: 0.4, speaker: null });
  }
  const body = Buffer.from(JSON.stringify(call));
  assert.ok(body.length > 1_048_576);
  assert.ok(body.length <= MAX_TRANSCRIPT_BYTES);
  let seen = "";
  const result = await scoreTranscript("life-long.json", body, async (transcript) => {
    seen = transcript;
    return judgment({
      predicted_nps: 1,
      nps_category: "detractor",
      sentiment_start: "negative",
      sentiment_end: "negative",
      resolved: false,
      csat: 1,
      primary_reason: "They wanted to cancel.",
      evidence: "I want to cancel this cover today because it costs too much.",
      summary: "The caller wanted to cancel.",
    });
  });
  assert.equal(seen, text);
  assert.equal(result.nps, null);
  assert.equal(result.predictedNps, 1);
  assert.equal(result.npsBand, "detractor");
  assert.equal(text.includes(result.evidence), true);
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
