import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveReferencesDir, resolveStoreDir } from "../../src/core/paths.ts";

const previous = process.env["FLUENTDEV_BR_DATA"];

beforeEach(() => {
  delete process.env["FLUENTDEV_BR_DATA"];
});

afterEach(() => {
  if (previous === undefined) {
    delete process.env["FLUENTDEV_BR_DATA"];
  } else {
    process.env["FLUENTDEV_BR_DATA"] = previous;
  }
});

describe("resolveReferencesDir", () => {
  it("finds the skill references relative to the module", () => {
    const dir = resolveReferencesDir();
    expect(existsSync(join(dir, "correction-protocol.md"))).toBe(true);
    expect(existsSync(join(dir, "l1-pt-br.md"))).toBe(true);
  });
});

describe("resolveStoreDir", () => {
  it("uses the explicit override when set", () => {
    process.env["FLUENTDEV_BR_DATA"] = "/tmp/et-override";
    expect(resolveStoreDir()).toEqual({ dir: "/tmp/et-override", origin: "override" });
  });

  it("resolves a home directory store by default", () => {
    const location = resolveStoreDir();
    expect(location.origin).toBe("home");
    expect(location.dir).toContain(".fluentdev-br");
  });
});
