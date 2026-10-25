import { isAbsolute, relative, resolve } from "node:path";
import type { Preferences } from "../core/preferences.ts";

// Whether the hooks should stay silent for this turn. The kill switch and a
// pause turn every hook off; a disabled project turns them off inside that
// working tree (docs/architecture.md, "CLI and hook rules" and "Preferences").
export function hooksDisabled(prefs: Preferences, cwd: string, now: Date = new Date()): boolean {
  if (process.env["FLUENTDEV_BR_DISABLE"] === "1") {
    return true;
  }
  if (isPaused(prefs.paused_until, now)) {
    return true;
  }
  return prefs.disabled_projects.some((project) => contains(project, cwd));
}

function isPaused(pausedUntil: string | undefined, now: Date): boolean {
  if (pausedUntil === undefined) {
    return false;
  }
  const until = Date.parse(pausedUntil);
  return !Number.isNaN(until) && now.getTime() < until;
}

// True when `cwd` is the project directory or sits inside it.
function contains(project: string, cwd: string): boolean {
  const rel = relative(resolve(project), resolve(cwd));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
