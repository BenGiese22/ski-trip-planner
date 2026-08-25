"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AvailabilityStatus } from "@/db/schema";
import { buildMonthGrids, datesInRange, quickPicks } from "@/lib/dates";
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

  const anchor = useRef<string | null>(null);
  const dragged = useRef(false);
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

  // A press that never leaves its cell is a click and cycles that day; one
  // that moves paints a range. Resolving it on pointer-up keeps a single tap
  // from being read as a one-day drag.
  useEffect(() => {
    if (!painting) return;
    const end = () => {
      if (!dragged.current && anchor.current) cycle(anchor.current);
      anchor.current = null;
      dragged.current = false;
      setPainting(false);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [painting, cycle]);

  function onPointerDown(date: string) {
    anchor.current = date;
    dragged.current = false;
    setPainting(true);
  }

  function onPointerEnter(date: string) {
    if (!painting || !anchor.current || anchor.current === date) return;
    dragged.current = true;
    paintRange(anchor.current, date);
  }

  function applyQuickPick(dates: string[]) {
    const next = new Map(statuses);
    for (const date of dates) next.set(date, "available");
    commit(next);
  }

  if (!started) {
    return (
      <p className="text-sm text-ink-soft border border-line rounded-lg p-4">
        Answer the questions up top and the calendar opens up here, so you can
        mark the days that could work for you.
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-2.5 flex-wrap mb-4">
        {quickPicks.map((pick) => (
          <button
            key={pick.label}
            type="button"
            onClick={() => applyQuickPick(pick.dates)}
            className="text-sm border border-line rounded-lg px-3 py-2 bg-paper hover:border-gold focus:outline-2 focus:outline-offset-2 focus:outline-pine"
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
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none"
        // Painting is driven by pointer events on the cells; suppressing the
        // browser's own drag/scroll gesture keeps a drag from turning into a
        // text selection or a page scroll mid-paint.
        style={{ touchAction: painting ? "none" : undefined }}
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
                    onPointerDown={() => onPointerDown(cell.date)}
                    onPointerEnter={() => onPointerEnter(cell.date)}
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
