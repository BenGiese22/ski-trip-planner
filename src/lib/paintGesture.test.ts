import { describe, expect, it } from "vitest";
import { endGesture, moveGesture, startGesture } from "./paintGesture";

describe("startGesture", () => {
  it("anchors on the pressed date, not yet dragged", () => {
    expect(startGesture("2027-01-20")).toEqual({ anchor: "2027-01-20", dragged: false });
  });
});

describe("moveGesture", () => {
  it("emits a paint action and marks the gesture dragged once it leaves the anchor", () => {
    const state = startGesture("2027-01-20");
    const result = moveGesture(state, "2027-01-22");

    expect(result.state).toEqual({ anchor: "2027-01-20", dragged: true });
    expect(result.action).toEqual({ type: "paint", from: "2027-01-20", to: "2027-01-22" });
  });

  it("is a no-op while the pointer is still over the anchor cell", () => {
    const state = startGesture("2027-01-20");
    const result = moveGesture(state, "2027-01-20");

    expect(result.state).toEqual(state);
    expect(result.action).toBeUndefined();
  });

  it("is a no-op once there's no anchor (nothing pressed)", () => {
    const state = { anchor: null, dragged: false };
    const result = moveGesture(state, "2027-01-20");

    expect(result.state).toEqual(state);
    expect(result.action).toBeUndefined();
  });

  it("keeps emitting paint actions as the pointer moves across further cells", () => {
    const state = { anchor: "2027-01-20", dragged: true };
    const result = moveGesture(state, "2027-01-23");

    expect(result.state).toEqual({ anchor: "2027-01-20", dragged: true });
    expect(result.action).toEqual({ type: "paint", from: "2027-01-20", to: "2027-01-23" });
  });
});

describe("endGesture", () => {
  it("cycles the anchor date when the pointer never left it — a tap", () => {
    const state = startGesture("2027-01-20");
    expect(endGesture(state)).toEqual({ action: { type: "cycle", date: "2027-01-20" } });
  });

  it("does nothing further once a drag already painted a range", () => {
    const state = { anchor: "2027-01-20", dragged: true };
    expect(endGesture(state)).toEqual({});
  });

  it("does nothing when there was never an anchor", () => {
    expect(endGesture({ anchor: null, dragged: false })).toEqual({});
  });
});
