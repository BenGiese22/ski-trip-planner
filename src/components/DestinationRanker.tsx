"use client";

import { useEffect, useRef, useState } from "react";
import { destinations } from "@/data/destinations";
import type { DestinationSlug } from "@/data/types";
import { DestinationCard } from "./DestinationCard";
import { useResponse } from "./ResponseProvider";

const DEFAULT_ORDER = destinations.map((d) => d.slug);
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

/**
 * Ranks the destinations best-first. Drag to reorder, or use the up/down
 * buttons — the buttons aren't a fallback, they're the path that works with a
 * keyboard, a screen reader, and a phone. Native HTML5 drag-and-drop is
 * effectively unusable by any of those, so shipping only the drag would have
 * failed §14's accessibility gate outright.
 *
 * The ranking starts *unset* rather than pre-filled with the declared order.
 * Pre-filling would give everyone a first choice they never actually made, and
 * Ben couldn't tell a considered ranking from an untouched form.
 */
export function DestinationRanker() {
  const { response, update } = useResponse();
  const [dragging, setDragging] = useState<DestinationSlug | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Focus has to follow a card that moved, or keyboard reordering loses the
  // user's place after every press.
  const pendingFocus = useRef<DestinationSlug | null>(null);
  const orderRef = useRef<DestinationSlug[]>(DEFAULT_ORDER);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document
      .querySelector<HTMLButtonElement>(`[data-rank-focus="${pendingFocus.current}"]`)
      ?.focus();
    pendingFocus.current = null;
  });

  // The cards are reference content and always render. Only the ranking
  // controls wait for intake — returning null here hid the destinations
  // entirely from first-time visitors.
  const started = response !== null;
  const ranked = (response?.destinationRanking.length ?? 0) > 0;
  const order = ranked ? response!.destinationRanking : DEFAULT_ORDER;

  // Two presses in quick succession both read the same render's `order`, so
  // the second recomputed the first move instead of continuing it — pressing
  // "up" twice left the card one place higher, not two. Handlers read the ref
  // instead, and commit() advances it, so consecutive moves compose.
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  function commit(next: DestinationSlug[], moved: DestinationSlug) {
    orderRef.current = next;
    update({ destinationRanking: next }, { immediate: true });
    const name = destinations.find((d) => d.slug === moved)?.name ?? moved;
    setAnnouncement(`${name} moved to ${ORDINALS[next.indexOf(moved)]} choice.`);
  }

  function move(slug: DestinationSlug, delta: number) {
    const current = orderRef.current;
    const from = current.indexOf(slug);
    const to = from + delta;
    if (to < 0 || to >= current.length) return;

    const next = [...current];
    [next[from], next[to]] = [next[to], next[from]];
    pendingFocus.current = slug;
    commit(next, slug);
  }

  function dropOn(target: DestinationSlug) {
    if (!dragging || dragging === target) return;
    const current = orderRef.current;
    const next = current.filter((slug) => slug !== dragging);
    next.splice(current.indexOf(target), 0, dragging);
    commit(next, dragging);
    setDragging(null);
  }

  return (
    <div>
      <p className="text-sm text-ink-soft max-w-[60ch] mb-4">
        {!started
          ? "Answer the questions up top and you can rank these in the order you'd prefer."
          : ranked
            ? "Drag to reorder, or use the arrows. Your first choice drives the cost estimate further down."
            : "Put these in the order you'd prefer — drag them, or use the arrows. Nothing is decided by this; it just shows Ben where the group leans."}
      </p>

      <ol className="flex flex-col gap-3.5 list-none p-0 min-w-0">
        {order.map((slug, index) => {
          const destination = destinations.find((d) => d.slug === slug);
          if (!destination) return null;

          return (
            <li
              key={slug}
              draggable={started}
              onDragStart={() => setDragging(slug)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(slug)}
              className={`min-w-0 ${dragging === slug ? "opacity-50" : ""}`}
            >
              {started && (
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  data-testid={`rank-badge-${slug}`}
                  className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                    ranked
                      ? "bg-pine text-snow"
                      : "bg-paper border border-line text-ink-soft"
                  }`}
                >
                  {ranked ? `${ORDINALS[index]} choice` : "not ranked yet"}
                </span>
                {/* min-w-0 is what actually lets this shrink: a flex item
                    won't go below its content width without it, so `truncate`
                    alone let the long names push the whole page wider than a
                    phone screen. */}
                <span className="text-sm text-ink-soft flex-1 min-w-0 truncate">
                  {destination.name}
                </span>

                <button
                  type="button"
                  data-rank-focus={slug}
                  disabled={index === 0}
                  onClick={() => move(slug, -1)}
                  aria-label={`Move ${destination.name} up to ${ORDINALS[index - 1] ?? "first"} choice`}
                  className="text-sm border border-line rounded-md px-2 py-1 bg-paper hover:border-gold disabled:opacity-40 focus:outline-2 focus:outline-offset-2 focus:outline-pine"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === order.length - 1}
                  onClick={() => move(slug, 1)}
                  aria-label={`Move ${destination.name} down to ${ORDINALS[index + 1] ?? "last"} choice`}
                  className="text-sm border border-line rounded-md px-2 py-1 bg-paper hover:border-gold disabled:opacity-40 focus:outline-2 focus:outline-offset-2 focus:outline-pine"
                >
                  ↓
                </button>
              </div>
              )}

              <DestinationCard destination={destination} />
            </li>
          );
        })}
      </ol>

      {started && !ranked && (
        <button
          type="button"
          onClick={() => commit([...DEFAULT_ORDER], DEFAULT_ORDER[0])}
          className="mt-3.5 text-sm border border-line rounded-md px-3 py-2 bg-paper hover:border-gold focus:outline-2 focus:outline-offset-2 focus:outline-pine"
        >
          This order works for me
        </button>
      )}

      {/* Reordering is a visual change; without this a screen-reader user gets
          no confirmation that their press did anything. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
