import { checkAdapter } from "./adapter-tree.ts";
import { CODEX_ADAPTER_DIR, generateCodexAdapter } from "./codex-adapter.ts";

// Installs from git run no build step, so the committed Codex adapter must match
// what the current plugin/ produces.
process.exitCode = await checkAdapter(CODEX_ADAPTER_DIR, generateCodexAdapter);
