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
};

export type GestureAction =
  | { type: "paint"; from: string; to: string }
  | { type: "cycle"; date: string };

export function startGesture(date: string): GestureState {
  return { anchor: date, dragged: false };
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
