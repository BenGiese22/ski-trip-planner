import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntakeForm } from "./IntakeForm";
import { useResponse } from "./ResponseProvider";
import type { ClientResponse } from "@/lib/serverSession";

vi.mock("./ResponseProvider", () => ({ useResponse: vi.fn() }));

function startedResponse(): ClientResponse {
  return {
    name: "Jamie Rivera",
    email: "jamie@example.com",
    plusOne: false,
    homeAirport: "SFO",
    skiLevel: "intermediate",
    skiDays: 2,
    alreadyHasPass: false,
    gearStatus: "rental",
    plusOneSkiDays: null,
    plusOneAlreadyHasPass: false,
    plusOneGearStatus: null,
    notes: null,
    submittedAt: null,
    destinationRanking: [],
    availability: [],
  };
}

function mockUseResponse(overrides: Partial<ReturnType<typeof useResponse>> = {}) {
  const update = vi.fn();
  vi.mocked(useResponse).mockReturnValue({
    response: null,
    loadFailed: false,
    sessionLost: false,
    status: "idle",
    lastSavedAt: null,
    problems: [],
    startResponse: vi.fn(),
    update,
    setAvailability: vi.fn(),
    finish: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  });
  return update;
}

describe("IntakeForm, first visit", () => {
  it("hides the start button when the initial load failed, since a row may already exist", () => {
    mockUseResponse({ loadFailed: true });
    render(<IntakeForm />);
    expect(screen.queryByRole("button", { name: /start my response/i })).toBeNull();
  });

  it("shows the start button normally for a genuine first-time visitor", () => {
    mockUseResponse();
    render(<IntakeForm />);
    expect(screen.getByRole("button", { name: /start my response/i })).toBeVisible();
  });
});

describe("IntakeForm, started", () => {
  it("debounces text field changes instead of flushing on every keystroke", () => {
    const update = mockUseResponse({ response: startedResponse() });
    render(<IntakeForm />);

    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: "Jamie R." },
    });

    expect(update).toHaveBeenCalledTimes(1);
    const [, options] = update.mock.calls[0];
    expect(options?.immediate).not.toBe(true);
  });

  it("flushes immediately on a select change", () => {
    const update = mockUseResponse({ response: startedResponse() });
    render(<IntakeForm />);

    fireEvent.change(screen.getByLabelText(/home airport/i), {
      target: { value: "ORD" },
    });

    expect(update).toHaveBeenCalledTimes(1);
    const [, options] = update.mock.calls[0];
    expect(options?.immediate).toBe(true);
  });

  it("flushes a text field immediately on blur", () => {
    const update = mockUseResponse({ response: startedResponse() });
    render(<IntakeForm />);

    const name = screen.getByLabelText(/your name/i);
    fireEvent.change(name, { target: { value: "Jamie R." } });
    fireEvent.blur(name);

    expect(update).toHaveBeenCalledTimes(2);
    const [, options] = update.mock.calls[1];
    expect(options?.immediate).toBe(true);
  });
});
