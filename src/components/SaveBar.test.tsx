import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveBar } from "./SaveBar";
import { useResponse } from "./ResponseProvider";
import type { ClientResponse } from "@/lib/serverSession";

vi.mock("./ResponseProvider", () => ({ useResponse: vi.fn() }));

function baseResponse(): ClientResponse {
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
  vi.mocked(useResponse).mockReturnValue({
    response: baseResponse(),
    loadFailed: false,
    sessionLost: false,
    status: "idle",
    lastSavedAt: null,
    problems: [],
    startResponse: vi.fn(),
    update: vi.fn(),
    setAvailability: vi.fn(),
    finish: vi.fn().mockResolvedValue({ ok: true }),
    retry: vi.fn(),
    ...overrides,
  });
}

describe("SaveBar", () => {
  it("shows a Retry control when a save has failed, not just an error label", () => {
    mockUseResponse({ status: "error" });
    render(<SaveBar />);

    expect(screen.getByText(/couldn't save/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /retry/i })).toBeVisible();
  });

  it("calls retry() when the Retry button is clicked", () => {
    const retry = vi.fn();
    mockUseResponse({ status: "error", retry });
    render(<SaveBar />);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("re-enables the finish button even when finish() rejects", async () => {
    const finish = vi.fn().mockRejectedValue(new Error("network down"));
    mockUseResponse({ finish });
    render(<SaveBar />);

    const button = screen.getByRole("button", { name: /save & finish/i });
    fireEvent.click(button);

    // Give the rejected promise a turn to settle.
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByRole("button", { name: /save & finish/i })).toBeEnabled();
  });

  it("shows no Retry control when nothing has failed", () => {
    mockUseResponse({ status: "saved", lastSavedAt: Date.now() });
    render(<SaveBar />);

    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
