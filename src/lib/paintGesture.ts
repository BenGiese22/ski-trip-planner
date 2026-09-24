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

/** The `pointermove` fields that decide whether a move belongs to the gesture. */
export type MoveInfo = { pointerId: number; pointerType: string; buttons: number };

/** `date` is the day under the pointer, or null when it's between/outside cells. */
export function moveGesture(
  state: GestureState,
  date: string | null,
  move: MoveInfo,
): { state: GestureState; action?: GestureAction } {
  if (move.pointerId !== state.pointerId) return { state };
  // A mouse move with the primary button up means the release happened
  // somewhere the grid never heard about (a swallowed pointerup), so the drag
  // is over. Only mouse is checked: touch and pen report `buttons` less
  // consistently, and they don't lose their pointerup this way.
  if (move.pointerType === "mouse" && (move.buttons & 1) === 0) return { state: IDLE };
  if (!state.anchor || date === null || state.anchor === date) return { state };

  return {
    state: { ...state, dragged: true },
    action: { type: "paint", from: state.anchor, to: date },
  };
}

/**
 * Only the pointer that started the gesture can end it. A press that never
 * left its cell is a tap, and resolves to a cycle.
 */
export function endGesture(
  state: GestureState,
  pointerId: number,
): { state: GestureState; action?: GestureAction } {
  if (pointerId !== state.pointerId) return { state };
  if (state.anchor && !state.dragged) {
    return { state: IDLE, action: { type: "cycle", date: state.anchor } };
  }
  return { state: IDLE };
}

/**
 * Abandons the gesture without cycling anything — for pointercancel, a lost
 * window focus, or a context menu. With no pointerId (a window-level event
 * that isn't tied to one) it always abandons.
 */
export function cancelGesture(state: GestureState, pointerId?: number): GestureState {
  if (pointerId !== undefined && pointerId !== state.pointerId) return state;
  return IDLE;
}
