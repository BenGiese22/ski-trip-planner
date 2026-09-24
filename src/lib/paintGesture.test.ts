import { describe, expect, it } from "vitest";
import { IDLE, endGesture, moveGesture, startGesture } from "./paintGesture";

/** An ordinary left-button (or first-finger) press. */
const press = { pointerId: 7, isPrimary: true, button: 0 };

describe("startGesture", () => {
  it("anchors on the pressed date, not yet dragged", () => {
    expect(startGesture("2027-01-20", press)).toMatchObject({
      anchor: "2027-01-20",
      dragged: false,
    });
  });

  it("records the pointer that pressed", () => {
    expect(startGesture("2027-01-20", press)).toEqual({
      anchor: "2027-01-20",
      dragged: false,
      pointerId: 7,
    });
  });

  it("ignores a non-primary pointer (second finger)", () => {
    const current = startGesture("2027-01-20", press);
    const second = { pointerId: 8, isPrimary: false, button: 0 };
    expect(startGesture("2027-01-25", second, current)).toBe(current);
    expect(startGesture("2027-01-25", second)).toBe(IDLE);
  });

  it("ignores any button but the primary (right-click)", () => {
    expect(startGesture("2027-01-20", { ...press, button: 2 })).toBe(IDLE);
    expect(startGesture("2027-01-20", { ...press, button: 1 })).toBe(IDLE);
  });

  it("a press mid-gesture does not move the anchor", () => {
    const current = { anchor: "2027-01-20", dragged: true, pointerId: 7 };
    expect(startGesture("2027-01-25", { ...press, pointerId: 9 }, current)).toBe(current);
  });
});

describe("moveGesture", () => {
  it("emits a paint action and marks the gesture dragged once it leaves the anchor", () => {
    const state = startGesture("2027-01-20", press);
    const result = moveGesture(state, "2027-01-22");

    expect(result.state).toEqual({ anchor: "2027-01-20", dragged: true, pointerId: 7 });
    expect(result.action).toEqual({ type: "paint", from: "2027-01-20", to: "2027-01-22" });
  });

  it("is a no-op while the pointer is still over the anchor cell", () => {
    const state = startGesture("2027-01-20", press);
    const result = moveGesture(state, "2027-01-20");

    expect(result.state).toEqual(state);
    expect(result.action).toBeUndefined();
  });

  it("is a no-op once there's no anchor (nothing pressed)", () => {
    const result = moveGesture(IDLE, "2027-01-20");

    expect(result.state).toEqual(IDLE);
    expect(result.action).toBeUndefined();
  });

  it("keeps emitting paint actions as the pointer moves across further cells", () => {
    const state = { anchor: "2027-01-20", dragged: true, pointerId: 7 };
    const result = moveGesture(state, "2027-01-23");

    expect(result.state).toEqual(state);
    expect(result.action).toEqual({ type: "paint", from: "2027-01-20", to: "2027-01-23" });
  });
});

describe("endGesture", () => {
  it("cycles the anchor date when the pointer never left it — a tap", () => {
    const state = startGesture("2027-01-20", press);
    expect(endGesture(state)).toEqual({ action: { type: "cycle", date: "2027-01-20" } });
  });

  it("does nothing further once a drag already painted a range", () => {
    const state = { anchor: "2027-01-20", dragged: true, pointerId: 7 };
    expect(endGesture(state)).toEqual({});
  });

  it("does nothing when there was never an anchor", () => {
    expect(endGesture(IDLE)).toEqual({});
  });
});
