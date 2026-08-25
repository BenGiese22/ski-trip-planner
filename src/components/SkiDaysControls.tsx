"use client";

import type { GearStatus, SkiDays } from "@/lib/costs";
import type { RespondentPatch } from "@/lib/schemas";
import { useResponse } from "./ResponseProvider";

const SKI_DAY_OPTIONS: SkiDays[] = [1, 2, 3];

type PersonCopy = {
  heading: string;
  ownGear: string;
  needGear: string;
  hasPass: string;
};

// Third person for the plus-one throughout — a first-person label under
// someone else's name reads as a copy bug (section 8).
const YOU: PersonCopy = {
  heading: "You",
  ownGear: "I'm bringing my own gear",
  needGear: "I need gear (rental)",
  hasPass: "I already have a pass",
};

const PLUS_ONE: PersonCopy = {
  heading: "Your plus-one",
  ownGear: "They're bringing their own gear",
  needGear: "They need gear (rental)",
  hasPass: "They already have a pass",
};

export function SkiDaysControls() {
  const { response } = useResponse();
  if (!response) return null;

  return (
    <div className={`grid grid-cols-1 gap-3.5 ${response.plusOne ? "sm:grid-cols-2" : ""}`}>
      <PersonControls
        copy={YOU}
        skiDays={response.skiDays}
        alreadyHasPass={response.alreadyHasPass}
        gearStatus={response.gearStatus}
        patchKeys={{
          skiDays: "skiDays",
          alreadyHasPass: "alreadyHasPass",
          gearStatus: "gearStatus",
        }}
      />
      {response.plusOne && (
        <PersonControls
          copy={PLUS_ONE}
          skiDays={response.plusOneSkiDays}
          alreadyHasPass={response.plusOneAlreadyHasPass}
          gearStatus={response.plusOneGearStatus}
          patchKeys={{
            skiDays: "plusOneSkiDays",
            alreadyHasPass: "plusOneAlreadyHasPass",
            gearStatus: "plusOneGearStatus",
          }}
        />
      )}
    </div>
  );
}

type PatchKeys = {
  skiDays: "skiDays" | "plusOneSkiDays";
  alreadyHasPass: "alreadyHasPass" | "plusOneAlreadyHasPass";
  gearStatus: "gearStatus" | "plusOneGearStatus";
};

function PersonControls({
  copy,
  skiDays,
  alreadyHasPass,
  gearStatus,
  patchKeys,
}: {
  copy: PersonCopy;
  skiDays: SkiDays | null;
  alreadyHasPass: boolean;
  gearStatus: GearStatus | null;
  patchKeys: PatchKeys;
}) {
  const { update } = useResponse();

  const set = (patch: RespondentPatch) => update(patch, { immediate: true });

  return (
    <fieldset className="border border-line rounded-lg p-4">
      <legend className="font-mono text-[11px] uppercase tracking-wide text-ink-soft px-1">
        {copy.heading}
      </legend>

      <div className="flex gap-2 flex-wrap mt-1">
        {SKI_DAY_OPTIONS.map((days) => (
          <Option
            key={days}
            selected={!alreadyHasPass && skiDays === days}
            onClick={() =>
              set({
                [patchKeys.skiDays]: days,
                [patchKeys.alreadyHasPass]: false,
              } as RespondentPatch)
            }
          >
            {days} {days === 1 ? "day" : "days"}
          </Option>
        ))}
        <Option
          selected={alreadyHasPass}
          onClick={() =>
            // ski_days is null for a pass holder — that's how the schema
            // encodes it (section 16, decision 6).
            set({
              [patchKeys.alreadyHasPass]: true,
              [patchKeys.skiDays]: null,
            } as RespondentPatch)
          }
        >
          {copy.hasPass}
        </Option>
      </div>

      <div className="flex gap-2 flex-wrap mt-2.5">
        <Option
          selected={gearStatus === "own"}
          onClick={() => set({ [patchKeys.gearStatus]: "own" } as RespondentPatch)}
        >
          {copy.ownGear}
        </Option>
        <Option
          selected={gearStatus === "rental"}
          onClick={() => set({ [patchKeys.gearStatus]: "rental" } as RespondentPatch)}
        >
          {copy.needGear}
        </Option>
      </div>
    </fieldset>
  );
}

function Option({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // A real button with aria-pressed, not a styled div — these are toggles
      // and need to announce their state and take focus (section 14).
      aria-pressed={selected}
      onClick={onClick}
      className={`text-[13px] border rounded-md px-3 py-1.5 focus:outline-2 focus:outline-offset-2 focus:outline-pine ${
        selected
          ? "border-gold bg-[#FFFAEF] font-semibold text-gold-deep"
          : "border-line bg-paper hover:border-gold"
      }`}
    >
      {children}
    </button>
  );
}
