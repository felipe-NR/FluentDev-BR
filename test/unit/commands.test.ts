import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dispatch } from "../../src/commands.ts";

let dir = "";
const previous = process.env["FLUENTDEV_BR_DATA"];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "et-cmd-"));
  process.env["FLUENTDEV_BR_DATA"] = dir;
});

afterEach(async () => {
  if (previous === undefined) {
    delete process.env["FLUENTDEV_BR_DATA"];
  } else {
    process.env["FLUENTDEV_BR_DATA"] = previous;
  }
  await rm(dir, { recursive: true, force: true });
});

describe("dispatch", () => {
  it("leaves help, version and unknown commands to the synchronous runner", async () => {
    expect((await dispatch(["version"])).handled).toBe(false);
    expect((await dispatch(["nope"])).handled).toBe(false);
  });

  it("treats a hook with an unknown client as a safe no-op", async () => {
    expect(await dispatch(["hook", "unknown-client", "user-prompt-submit"])).toEqual({
      handled: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("sets and gets a preference", async () => {
    const set = await dispatch(["config", "set", "strictness", "strict"]);
    expect(set.exitCode).toBe(0);
    expect(set.stdout).toContain("strict");
    const get = await dispatch(["config", "get", "strictness"]);
    expect(get.stdout.trim()).toBe("strict");
  });

  it("rejects an unknown preference on get", async () => {
    const outcome = await dispatch(["config", "get", "nope"]);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr).toContain("unknown preference");
  });

  it("prints an empty report", async () => {
    const outcome = await dispatch(["report", "--period", "all"]);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain("English practice log");
  });

  it("rejects an invalid report period", async () => {
    const outcome = await dispatch(["report", "--period", "year"]);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr).toContain("--period");
  });

  it("refuses to purge without confirmation", async () => {
    const outcome = await dispatch(["purge", "--all"]);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr).toContain("--yes");
  });

  it("purges everything with confirmation", async () => {
    const outcome = await dispatch(["purge", "--all", "--yes"]);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain("Removed");
  });

  it("reports diagnostics", async () => {
    const outcome = await dispatch(["doctor"]);
    expect(outcome.stdout).toContain("node ");
    expect(outcome.stdout).toContain("store ");
    expect(outcome.stdout).toContain("references ");
  });
});
