"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AvailabilityStatus } from "@/db/schema";
import { buildMonthGrids, datesInRange, quickPicks } from "@/lib/dates";
import { endGesture, moveGesture, startGesture, type GestureState } from "@/lib/paintGesture";
import { EmptyState } from "./EmptyState";
import { useResponse } from "./ResponseProvider";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const NEXT_STATUS: Record<string, AvailabilityStatus | undefined> = {
  unset: "available",
  available: "maybe",
  maybe: "unavailable",
  unavailable: undefined,
};

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  available: "available",
  maybe: "maybe",
  unavailable: "can't make it",
};

const STATUS_CLASSES: Record<AvailabilityStatus, string> = {
  available: "bg-green-mid border-[#8FBE77] text-[#1D3A20] font-semibold",
  maybe: "bg-[#FFFAEF] border-gold text-gold-deep font-semibold",
  unavailable: "bg-[#EFEFEA] border-line text-ink-soft line-through",
};

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function describe(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return LONG_DATE.format(new Date(Date.UTC(y, m - 1, d)));
}

export function AvailabilityGrid() {
  const { response, setAvailability } = useResponse();
  const started = response !== null;

  const statuses = useMemo(() => {
    const map = new Map<string, AvailabilityStatus>();
    for (const entry of response?.availability ?? []) map.set(entry.date, entry.status);
    return map;
  }, [response?.availability]);

  const grids = useMemo(() => buildMonthGrids(), []);

  const commit = useCallback(
    (next: Map<string, AvailabilityStatus>) => {
      setAvailability([...next].map(([date, status]) => ({ date, status })));
    },
    [setAvailability],
  );

  const gesture = useRef<GestureState>({ anchor: null, dragged: false });
  const [painting, setPainting] = useState(false);

  const paintRange = useCallback(
    (from: string, to: string) => {
      const next = new Map(statuses);
      for (const date of datesInRange(from, to)) {
        next.set(date, "available");
      }
      commit(next);
    },
    [statuses, commit],
  );

  const cycle = useCallback(
    (date: string) => {
      const current = statuses.get(date) ?? "unset";
      const next = new Map(statuses);
      const value = NEXT_STATUS[current];
      if (value) next.set(date, value);
      else next.delete(date);
      commit(next);
    },
    [statuses, commit],
  );

  // Refs so the pointer listeners below always call the latest paintRange/
  // cycle without needing to resubscribe mid-drag every time `statuses`
  // (and so `paintRange`/`cycle`) gets a new identity.
  const paintRangeRef = useRef(paintRange);
  const cycleRef = useRef(cycle);
  useEffect(() => {
    paintRangeRef.current = paintRange;
    cycleRef.current = cycle;
  }, [paintRange, cycle]);

  function onPointerDown(date: string) {
    gesture.current = startGesture(date);
    setPainting(true);
  }

  // Touch gives the cell under pointerdown implicit capture, so pointermove
  // (and the per-cell pointerenter it would otherwise drive) keeps targeting
  // that first cell no matter where the finger goes — a drag that starts on
  // day one only ever paints day one. Tracking one pointer over the whole
  // grid and reading the cell under it via elementFromPoint sidesteps that
  // capture entirely, and works identically for mouse.
  useEffect(() => {
    if (!painting) return;

    function dateAt(x: number, y: number): string | null {
      const el = document.elementFromPoint(x, y);
      return el instanceof Element
        ? (el.closest<HTMLElement>("[data-date]")?.dataset.date ?? null)
        : null;
    }

    function onMove(e: PointerEvent) {
      const date = dateAt(e.clientX, e.clientY);
      if (!date) return;
      const { state, action } = moveGesture(gesture.current, date);
      gesture.current = state;
      if (action?.type === "paint") paintRangeRef.current(action.from, action.to);
    }

    function onUp() {
      const { action } = endGesture(gesture.current);
      if (action?.type === "cycle") cycleRef.current(action.date);
      gesture.current = { anchor: null, dragged: false };
      setPainting(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [painting]);

  function applyQuickPick(dates: string[]) {
    const next = new Map(statuses);
    for (const date of dates) next.set(date, "available");
    commit(next);
  }

  if (!started) {
    return (
      <EmptyState>
        Answer the questions up top and the calendar opens up here, so you can
        mark the days that could work for you.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2.5 sm:flex-wrap mb-4">
        {quickPicks.map((pick) => (
          <button
            key={pick.label}
            type="button"
            onClick={() => applyQuickPick(pick.dates)}
            className="w-full sm:w-auto text-sm border border-line rounded-lg px-3 py-2 bg-paper hover:border-gold focus:outline-2 focus:outline-offset-2 focus:outline-pine"
          >
            {pick.label} <span className="text-ink-soft">({pick.note})</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-soft mb-3">
        Tap a day to cycle it through available, maybe, and can&rsquo;t make it.
        Drag across several days to mark them all available at once.
      </p>

      <div
        // Static, not gated on `painting`: touch-action is decided once, at
        // the very first touchstart of a sequence, before React ever gets a
        // chance to re-render — setting it only once painting is already
        // true is always one gesture too late, and the browser has already
        // started treating the drag as a native pan by then. `pan-y` keeps
        // vertical scrolling native (so the page never gets stuck) while
        // still leaving horizontal touch drags — the common case, painting
        // a run of days in one week — to our own pointer handling instead of
        // the browser's.
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none touch-pan-y"
      >
        {grids.map((grid) => (
          <div key={grid.label}>
            <h3 className="font-serif text-base mb-2">{grid.label}</h3>
            <div
              className="grid grid-cols-7 gap-[3px] mb-1 text-center font-mono text-[10px] text-ink-soft"
              aria-hidden="true"
            >
              {WEEKDAYS.map((day, i) => (
                <span key={`${day}-${i}`}>{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-[3px]" role="group" aria-label={grid.label}>
              {grid.cells.map((cell, i) => {
                if (cell.kind === "blank") {
                  return <div key={`blank-${i}`} aria-hidden="true" className="aspect-square" />;
                }

                const status = statuses.get(cell.date);
                const base =
                  "aspect-square text-[12px] rounded border flex items-center justify-center " +
                  "focus:outline-2 focus:outline-offset-1 focus:outline-pine";

                return (
                  <button
                    key={cell.date}
                    type="button"
                    data-date={cell.date}
                    onPointerDown={() => onPointerDown(cell.date)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        cycle(cell.date);
                      }
                    }}
                    aria-label={`${describe(cell.date)} — ${
                      status ? STATUS_LABEL[status] : "not set"
                    }${cell.isBlackout ? ", Ikon Session Pass blackout" : ""}`}
                    className={`${base} ${
                      status ? STATUS_CLASSES[status] : "bg-paper border-line hover:border-gold"
                    } ${cell.isBlackout ? "outline outline-1 outline-dashed outline-rust" : ""}`}
                  >
                    {cell.dayOfMonth}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 flex-wrap mt-4 text-xs text-ink-soft">
        <Swatch className="bg-green-mid border-[#8FBE77]" label="Available" />
        <Swatch className="bg-[#FFFAEF] border-gold" label="Maybe" />
        <Swatch className="bg-[#EFEFEA] border-line" label="Can't make it" />
        <Swatch
          className="border-dashed border-rust"
          label="Ikon Session Pass blackout at Steamboat and Winter Park — you can still mark these"
        />
        <span>Blank cells: outside the mid-Jan–mid-Mar window on purpose</span>
      </div>

      <p className="text-xs text-ink-soft mt-2">
        Tell us when you could go regardless of where — the blackout flag is
        just so you know those days don&rsquo;t work at two of the three
        options. Copper Mountain has no blackout dates on any Ikon tier.
      </p>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span>
      <span
        className={`inline-block w-2.5 h-2.5 rounded-[3px] border mr-1.5 -mb-px ${className}`}
      />
      {label}
    </span>
  );
}
