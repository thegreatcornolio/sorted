import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadLocalSettings(): void {
  let values: Record<string, string> | undefined;
  try {
    const file = JSON.parse(readFileSync(resolve(process.cwd(), "local.settings.json"), "utf8")) as {
      Values?: Record<string, string>;
    };
    values = file.Values;
  } catch {
    return;
  }
  for (const [key, value] of Object.entries(values ?? {})) {
    if (process.env[key] == null && typeof value === "string") process.env[key] = value;
  }
}
