import { describe, it, expect } from "vitest";
import { buildReplayStateAtTime } from "../buildReplayStateAtTime";

describe("Replay Seeking", () => {
  it("rebuilds the correct state after seeking backwards", () => {
    const events = [
      { timestampMs: 100, type: "element.created", payload: { element: { id: "el1" } } },
      { timestampMs: 200, type: "element.created", payload: { element: { id: "el2" } } }
    ];
    
    const stateForward = buildReplayStateAtTime({
      currentTime: 250,
      initialSnapshot: { elements: [] },
      events
    });
    expect(stateForward.elements).toHaveLength(2);

    const stateBack = buildReplayStateAtTime({
      currentTime: 150,
      initialSnapshot: { elements: [] },
      events
    });
    expect(stateBack.elements).toHaveLength(1);
    expect(stateBack.elements[0].id).toBe("el1");
  });

  it("uses checkpoints for faster seeking", () => {
    const initialSnapshot = { elements: [] };
    const events = [
      { timestampMs: 100, type: "element.created", payload: { element: { id: "el1" } } },
      { timestampMs: 200, type: "element.created", payload: { element: { id: "el2" } } }
    ];
    const checkpoints = [
      { 
        timestampMs: 150, 
        elementsSnapshot: [{ id: "el1" }],
        camera: { x: 0, y: 0, z: 1 }
      }
    ];

    const state = buildReplayStateAtTime({
      currentTime: 250,
      initialSnapshot,
      events,
      checkpoints
    });

    expect(state.elements).toHaveLength(2);
    expect(state.elements[0].id).toBe("el1");
    expect(state.elements[1].id).toBe("el2");
  });
});
