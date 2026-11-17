import type { VulnerableCustomer } from "./live-pulse";

/** Browser-only follow-up state. The desk never writes a score or a pulse. */
export const ENGAGING_STORAGE_KEY = "sorted-vulnerable-customer-engaging";

export type DeskChannel = "call" | "email";

export type FollowPhase = "engaging" | "completed";

export type DeskOutcome = "saved" | "lost" | "no_answer";

export type EngagingEntry = {
  file: string;
  channel: DeskChannel;
  movedAt: string;
  phase: FollowPhase;
  outcome: DeskOutcome | null;
};

export type DeskPerson = VulnerableCustomer & {
  label: string;
  email: string;
  phone: string;
};

export type EngagingPerson = DeskPerson & EngagingEntry;

export type DeskLists = {
  queue: DeskPerson[];
  engaging: EngagingPerson[];
  completed: EngagingPerson[];
};

export type DeskCounts = {
  vulnerable: number;
  attention: number;
  engaging: number;
  completed: number;
  saved: number;
  lost: number;
  noAnswer: number;
};

const OUTCOMES = new Set<DeskOutcome>(["saved", "lost", "no_answer"]);

export function dummyEmail(slot: number): string {
  return `customer${slot}@example.com`;
}

/** 555-0100 numbers are reserved for fiction. The extra digits keep each row distinct and obviously fake. */
export function dummyPhone(slot: number): string {
  return `555-010-${String(slot).padStart(4, "0")}`;
}

export function fileStem(file: string): string {
  const base = file.split("/").pop() || file;
  const stem = base.replace(/\.[^.]+$/, "");
  return stem || base;
}

/** A pulse row often carries the file id in `person`. That is not a name. */
export function isMissingName(person: string, file: string): boolean {
  const name = person.trim();
  if (!name) return true;
  if (name === file.trim()) return true;
  return name === fileStem(file);
}

/** Newest flagged person is Customer 1 when their name is missing. Numbers follow the live list order. */
export function deskPeople(people: VulnerableCustomer[]): DeskPerson[] {
  const sorted = [...people].sort(
    (a, b) => b.scoredAt.localeCompare(a.scoredAt) || a.person.localeCompare(b.person) || a.file.localeCompare(b.file),
  );
  return sorted.map((person, index) => {
    const slot = index + 1;
    const label = isMissingName(person.person, person.file) ? `Customer ${slot}` : person.person.trim();
    return {
      ...person,
      label,
      email: dummyEmail(slot),
      phone: dummyPhone(slot),
    };
  });
}

export function followUpEmail(person: Pick<DeskPerson, "label" | "vulnerability_reason" | "next_step">): {
  subject: string;
  body: string;
} {
  const reason = sentence(person.vulnerability_reason);
  const next = nextStepSentence(person.next_step);
  const body = [
    `Hello ${person.label},`,
    "",
    `Thank you for speaking with us. ${reason}`,
    "",
    `${next} We can offer payment options that are lower cost and keep close to the same benefits.`,
    "",
    "If you would like to go through those options, reply to this message.",
    "",
    "Sorted.ai",
  ].join("\n");
  return { subject: "Lower-cost payment options", body };
}

export function readEngaging(storage: Pick<Storage, "getItem">): EngagingEntry[] {
  try {
    const raw = storage.getItem(ENGAGING_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: EngagingEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const file = typeof record.file === "string" ? record.file.trim() : "";
      const channel = record.channel === "call" || record.channel === "email" ? record.channel : null;
      const movedAt = typeof record.movedAt === "string" ? record.movedAt : "";
      const outcome = typeof record.outcome === "string" && OUTCOMES.has(record.outcome as DeskOutcome) ? (record.outcome as DeskOutcome) : null;
      if (!file || !channel) continue;
      entries.push({
        file,
        channel,
        movedAt,
        phase: record.phase === "completed" ? "completed" : "engaging",
        outcome,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

export function writeEngaging(storage: Pick<Storage, "setItem">, entries: EngagingEntry[]): boolean {
  try {
    storage.setItem(ENGAGING_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function engage(
  entries: EngagingEntry[],
  entry: Pick<EngagingEntry, "file" | "channel" | "movedAt"> & Partial<Pick<EngagingEntry, "phase" | "outcome">>,
): EngagingEntry[] {
  const next: EngagingEntry = {
    file: entry.file,
    channel: entry.channel,
    movedAt: entry.movedAt,
    phase: entry.phase === "completed" ? "completed" : "engaging",
    outcome: entry.outcome ?? null,
  };
  return [...entries.filter((item) => item.file !== next.file), next];
}

export function completeFollowUp(entries: EngagingEntry[], file: string): EngagingEntry[] {
  return entries.map((entry) => (entry.file === file ? { ...entry, phase: "completed" } : entry));
}

export function setFollowUpOutcome(entries: EngagingEntry[], file: string, outcome: DeskOutcome): EngagingEntry[] {
  return entries.map((entry) => (entry.file === file && entry.phase !== undefined ? { ...entry, outcome } : entry));
}

export function splitDesk(people: DeskPerson[], entries: EngagingEntry[]): DeskLists {
  const byFile = new Map(entries.map((entry) => [entry.file, entry]));
  const queue: DeskPerson[] = [];
  const engaging: EngagingPerson[] = [];
  const completed: EngagingPerson[] = [];
  for (const person of people) {
    const entry = byFile.get(person.file);
    if (!entry) {
      queue.push(person);
      continue;
    }
    const row: EngagingPerson = { ...person, ...entry, file: person.file };
    if (entry.phase === "completed") completed.push(row);
    else engaging.push(row);
  }
  const byRecent = (a: EngagingPerson, b: EngagingPerson) => b.movedAt.localeCompare(a.movedAt) || a.label.localeCompare(b.label);
  engaging.sort(byRecent);
  completed.sort(byRecent);
  return { queue, engaging, completed };
}

export function deskCounts(lists: DeskLists): DeskCounts {
  const tracked = [...lists.engaging, ...lists.completed];
  return {
    vulnerable: lists.queue.length + tracked.length,
    attention: lists.queue.length,
    engaging: lists.engaging.length,
    completed: lists.completed.length,
    saved: tracked.filter((person) => person.outcome === "saved").length,
    lost: tracked.filter((person) => person.outcome === "lost").length,
    noAnswer: tracked.filter((person) => person.outcome === "no_answer").length,
  };
}

/** Bar length against the vulnerable total, so an empty desk draws no bar. */
export function countShare(count: number, total: number): number {
  if (count <= 0 || total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function voice(text: string): string {
  return text
    .replace(/\bthe patient's\b/gi, "your")
    .replace(/\bthe customer's\b/gi, "your")
    .replace(/\bthe caller's\b/gi, "your")
    .replace(/\bthe patient\b/gi, "you")
    .replace(/\bthe customer\b/gi, "you")
    .replace(/\bthe caller\b/gi, "you");
}

const STATEMENT = /^(?:the|a|an|this|that|these|those|their|they|we|i)\b/i;

function nextStepSentence(step: string): string {
  const raw = step.trim().replace(/[.!?]+$/g, "");
  if (!raw) return "We will follow up with payment options that are lower cost and keep close to the same benefits.";
  const voiced = voice(raw);
  const adjusted = voiced === raw ? voiced : voiced.replace(/\btheir\b/gi, "your");
  if (STATEMENT.test(adjusted)) return sentence(adjusted);
  const second = adjusted[1] ?? "";
  const action = second === second.toLowerCase() ? adjusted[0].toLowerCase() + adjusted.slice(1) : adjusted;
  return `We will ${action}.`;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const capitalized = trimmed[0].toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}
