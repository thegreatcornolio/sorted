import { analyzeTranscript } from "./analyze";
import { transcripts } from "./transcripts";
import type { Analysis, Transcript } from "./types";

export type Row = { transcript: Transcript; analysis: Analysis; order: number };

export function allRows(): Row[] {
  return transcripts.map((transcript, order) => ({
    transcript,
    analysis: analyzeTranscript(transcript),
    order,
  }));
}
