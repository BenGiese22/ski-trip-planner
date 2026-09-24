/**
 * The press/drag/release arithmetic behind the availability grid, pulled out
 * of the component so it can be tested without simulating pointer capture.
 *
 * Touch gives the element under `pointerdown` implicit capture: every later
 * `pointermove` (and the `pointerenter`/`pointerleave` pair it would
 * otherwise fire) keeps targeting that first cell, not whatever the finger is
 * now over. So the component can't drive this off per-cell pointer events —
 * it has to track one pointer over the whole grid and feed this reducer the
 * date under it (via `document.elementFromPoint`), which works the same
 * under mouse and touch.
 */

export type GestureState = {
  anchor: string | null;
  dragged: boolean;
  pointerId: number | null;
};

export const IDLE: GestureState = { anchor: null, dragged: false, pointerId: null };

export type GestureAction =
  | { type: "paint"; from: string; to: string }
  | { type: "cycle"; date: string };

/** The `pointerdown` fields that decide whether a press may start a gesture. */
export type PressInfo = { pointerId: number; isPrimary: boolean; button: number };

/**
 * Only a primary pointer's primary button starts a gesture, and only when
 * none is already underway. A right-click, a middle-click, or a second finger
 * landing mid-drag hands back `current` untouched — the same object, so the
 * caller can tell nothing started.
 */
export function startGesture(
  date: string,
  press: PressInfo,
  current: GestureState = IDLE,
): GestureState {
  if (!press.isPrimary || press.button !== 0 || current.anchor !== null) return current;
  return { anchor: date, dragged: false, pointerId: press.pointerId };
}

export function moveGesture(
  state: GestureState,
  date: string,
): { state: GestureState; action?: GestureAction } {
  if (!state.anchor || state.anchor === date) return { state };

  return {
    state: { ...state, dragged: true },
    action: { type: "paint", from: state.anchor, to: date },
  };
}

export function endGesture(state: GestureState): { action?: GestureAction } {
  if (state.anchor && !state.dragged) {
    return { action: { type: "cycle", date: state.anchor } };
  }
  return {};
}
