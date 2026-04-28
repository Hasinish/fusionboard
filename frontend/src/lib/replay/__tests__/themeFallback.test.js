import { describe, it, expect } from "vitest";
import { buildReplayStateAtTime } from "../buildReplayStateAtTime";

describe("Replay Theme Fallback", () => {
  it("defaults to light theme when no theme metadata exists", () => {
    const state = buildReplayStateAtTime({
      currentTime: 0,
      initialSnapshot: { elements: [] },
      events: []
    });
    expect(state.isDark).toBe(false);
    expect(state.bgMode).toBe("white");
  });

  it("uses initialSnapshot.isDark when present", () => {
    const state = buildReplayStateAtTime({
      currentTime: 0,
      initialSnapshot: { elements: [], isDark: true },
      events: []
    });
    expect(state.isDark).toBe(true);
  });

  it("applies theme.changed events correctly", () => {
    const events = [
      { timestampMs: 500, type: "theme.changed", payload: { isDark: true } }
    ];
    const stateBefore = buildReplayStateAtTime({
      currentTime: 400,
      initialSnapshot: { isDark: false },
      events
    });
    const stateAfter = buildReplayStateAtTime({
      currentTime: 600,
      initialSnapshot: { isDark: false },
      events
    });
    expect(stateBefore.isDark).toBe(false);
    expect(stateAfter.isDark).toBe(true);
  });

  it("uses the recorded background mode and applies background changes", () => {
    const events = [
      { timestampMs: 500, type: "bgMode.changed", payload: { bgMode: "grid" } }
    ];
    const stateBefore = buildReplayStateAtTime({
      currentTime: 400,
      initialSnapshot: { elements: [], bgMode: "dots" },
      events
    });
    const stateAfter = buildReplayStateAtTime({
      currentTime: 600,
      initialSnapshot: { elements: [], bgMode: "dots" },
      events
    });
    expect(stateBefore.bgMode).toBe("dots");
    expect(stateAfter.bgMode).toBe("grid");
  });
});
