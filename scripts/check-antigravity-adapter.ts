import { checkAdapter } from "./adapter-tree.ts";
import { ANTIGRAVITY_ADAPTER_DIR, generateAntigravityAdapter } from "./antigravity-adapter.ts";

// Installs from git run no build step, so the committed Antigravity adapter must
// match what the current plugin/ produces.
process.exitCode = await checkAdapter(ANTIGRAVITY_ADAPTER_DIR, generateAntigravityAdapter);
