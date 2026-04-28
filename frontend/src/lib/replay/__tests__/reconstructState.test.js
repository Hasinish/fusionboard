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

  it("captures cursor and live stroke state at the replay time", () => {
    const events = [
      {
        timestampMs: 100,
        type: "cursor.moved",
        targetElementId: "user-1",
        payload: { x: 10, y: 20, name: "Alex", color: "#2563eb" }
      },
      {
        timestampMs: 120,
        type: "liveStroke.updated",
        targetElementId: "user-1",
        payload: {
          stroke: {
            id: "stroke-1",
            points: [{ x: 10, y: 20 }, { x: 12, y: 24 }],
            color: "#2563eb",
            width: 2
          }
        }
      },
      { timestampMs: 200, type: "liveStroke.ended", targetElementId: "user-1" }
    ];

    const duringStroke = buildReplayStateAtTime({
      currentTime: 150,
      initialSnapshot: { elements: [] },
      events
    });
    const afterStroke = buildReplayStateAtTime({
      currentTime: 250,
      initialSnapshot: { elements: [] },
      events
    });

    expect(duringStroke.cursors["user-1"].x).toBe(10);
    expect(duringStroke.liveStrokes["user-1"].id).toBe("stroke-1");
    expect(afterStroke.liveStrokes["user-1"]).toBeUndefined();
  });
});
