import { afterEach, describe, expect, it } from "vitest";
import { defaultPreferences, type Preferences } from "../../src/core/preferences.ts";
import { hooksDisabled } from "../../src/hooks/gates.ts";

const now = new Date("2026-09-13T12:00:00.000Z");

function prefs(overrides: Partial<Preferences>): Preferences {
  return { ...defaultPreferences(), ...overrides };
}

describe("hooksDisabled", () => {
  const previous = process.env["FLUENTDEV_BR_DISABLE"];
  afterEach(() => {
    if (previous === undefined) {
      delete process.env["FLUENTDEV_BR_DISABLE"];
    } else {
      process.env["FLUENTDEV_BR_DISABLE"] = previous;
    }
  });

  it("is false with default preferences", () => {
    delete process.env["FLUENTDEV_BR_DISABLE"];
    expect(hooksDisabled(defaultPreferences(), "/home/user/project", now)).toBe(false);
  });

  it("is true when the kill switch is set", () => {
    process.env["FLUENTDEV_BR_DISABLE"] = "1";
    expect(hooksDisabled(defaultPreferences(), "/home/user/project", now)).toBe(true);
  });

  it("is true while a pause is active and false after it", () => {
    delete process.env["FLUENTDEV_BR_DISABLE"];
    const paused = prefs({ paused_until: "2026-09-13T18:00:00.000Z" });
    expect(hooksDisabled(paused, "/home/user/project", now)).toBe(true);
    expect(hooksDisabled(paused, "/home/user/project", new Date("2026-09-13T19:00:00.000Z"))).toBe(false);
  });

  it("is true inside a disabled project and false outside it", () => {
    delete process.env["FLUENTDEV_BR_DISABLE"];
    const disabled = prefs({ disabled_projects: ["/home/user/work"] });
    expect(hooksDisabled(disabled, "/home/user/work/service", now)).toBe(true);
    expect(hooksDisabled(disabled, "/home/user/personal", now)).toBe(false);
  });
});
