import { scoreIncomingFromEnv } from "./azure";
import { loadLocalSettings } from "./settings";

loadLocalSettings();

scoreIncomingFromEnv()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((error: unknown) => {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "Scoring failed.";
    console.error(message);
    process.exitCode = 1;
  });
