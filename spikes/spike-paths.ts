import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

export const LOG_DIR = join(tmpdir(), "fluentdev-br-spike");
export const LOG_FILE = join(LOG_DIR, "events.jsonl");

// Stand-in for the per-user store from decision D4, resolved through the OS
// user API instead of environment variables.
export const USER_STORE = join(userInfo().homedir, ".fluentdev-br-spike");
