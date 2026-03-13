import { describe, it, expect } from "vitest";
import { buildReplayStateAtTime } from "../buildReplayStateAtTime";

describe("Replay State Reconstruction", () => {
  it("renders initial snapshot elements even with zero events", () => {
    const initialSnapshot = {
      elements: [{ id: "el1", type: "rect", x: 10, y: 10, w: 50, h: 50 }],
      isDark: false
    };
    const state = buildReplayStateAtTime({
      currentTime: 1000,
      initialSnapshot,
      events: []
    });
    expect(state.elements).toHaveLength(1);
    expect(state.elements[0].id).toBe("el1");
  });

  it("reconstructs element.created correctly", () => {
    const events = [
      { 
        timestampMs: 500, 
        type: "element.created", 
        payload: { element: { id: "el1", type: "rect" } } 
      }
    ];
    const state = buildReplayStateAtTime({
      currentTime: 1000,
      initialSnapshot: { elements: [] },
      events
    });
    expect(state.elements).toHaveLength(1);
    expect(state.elements[0].id).toBe("el1");
  });

  it("handles element.updated correctly", () => {
    const initialSnapshot = {
      elements: [{ id: "el1", type: "rect", x: 10 }]
    };
    const events = [
      { 
        timestampMs: 500, 
        type: "element.updated", 
        targetElementId: "el1", 
        payload: { element: { x: 50 } } 
      }
    ];
    const state = buildReplayStateAtTime({
      currentTime: 1000,
      initialSnapshot,
      events
    });
    expect(state.elements[0].x).toBe(50);
  });

  it("handles element.deleted correctly", () => {
    const initialSnapshot = {
      elements: [{ id: "el1", type: "rect" }]
    };
    const events = [
      { 
        timestampMs: 500, 
        type: "element.deleted", 
        targetElementId: "el1" 
      }
    ];
    const state = buildReplayStateAtTime({
      currentTime: 1000,
      initialSnapshot,
      events
    });
    expect(state.elements).toHaveLength(0);
  });

  it("handles board.cleared correctly", () => {
    const initialSnapshot = {
      elements: [{ id: "el1" }, { id: "el2" }]
    };
    const events = [
      { timestampMs: 500, type: "board.cleared" }
    ];
    const state = buildReplayStateAtTime({
      currentTime: 1000,
      initialSnapshot,
      events
    });
    expect(state.elements).toHaveLength(0);
  });

  it("respects currentTime and does not apply future events", () => {
    const events = [
      { timestampMs: 500, type: "element.created", payload: { element: { id: "el1" } } },
      { timestampMs: 1500, type: "element.created", payload: { element: { id: "el2" } } }
    ];
    const state = buildReplayStateAtTime({
      currentTime: 1000,
      initialSnapshot: { elements: [] },
      events
    });
    expect(state.elements).toHaveLength(1);
    expect(state.elements[0].id).toBe("el1");
  });
});
