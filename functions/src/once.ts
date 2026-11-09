import { scoreIncomingFromEnv } from "./azure";
import { safeErrorMessage } from "./openai";
import { loadLocalSettings } from "./settings";

loadLocalSettings();

scoreIncomingFromEnv()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((error: unknown) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
