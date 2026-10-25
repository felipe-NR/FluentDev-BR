import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STORE_DIR_NAME = ".fluentdev-br";
const REFERENCES_SUFFIX = join("skills", "fluentdev-br", "references");

export interface StoreLocation {
  readonly dir: string;
  // The base whose writability decided the location: the OS home directory, the
  // PLUGIN_DATA fallback, or an explicit override (docs/architecture.md,
  // "Storage and privacy"; decision D4).
  readonly origin: "home" | "plugin-data" | "override";
}

function isWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// One store per OS user, resolved through the OS user API instead of a base
// environment variable, because spec §9.1 forbids depending on those. When the
// home store is not writable (for example inside a sandbox) the plugin data
// directory is the fallback. FLUENTDEV_BR_DATA overrides both; it exists for
// tests and locked-down setups and is never required.
export function resolveStoreDir(): StoreLocation {
  const override = process.env["FLUENTDEV_BR_DATA"];
  if (override !== undefined && override !== "") {
    return { dir: override, origin: "override" };
  }

  const home = safeHomedir();
  if (home !== undefined) {
    const dir = join(home, STORE_DIR_NAME);
    if (isWritable(dir)) {
      return { dir, origin: "home" };
    }
  }

  const pluginData = process.env["PLUGIN_DATA"];
  if (pluginData !== undefined && pluginData !== "") {
    return { dir: join(pluginData, "fluentdev-br"), origin: "plugin-data" };
  }

  throw new Error("no writable store directory: home is not writable and PLUGIN_DATA is unset");
}

function safeHomedir(): string | undefined {
  try {
    const home = userInfo().homedir;
    return home === "" ? undefined : home;
  } catch {
    return undefined;
  }
}

// The directory of the skill reference markdown, resolved relative to this
// module so the bundle and the source tree both find it. In the committed
// bundle (plugin/dist/tutor.mjs) the references sit at ../skills/...; in the
// source tree they sit under plugin/skills/... a few levels up.
export function resolveReferencesDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth += 1) {
    const direct = join(dir, REFERENCES_SUFFIX);
    if (existsSync(join(direct, "correction-protocol.md"))) {
      return direct;
    }
    const nested = join(dir, "plugin", REFERENCES_SUFFIX);
    if (existsSync(join(nested, "correction-protocol.md"))) {
      return nested;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error("skill references not found relative to the running module");
}
