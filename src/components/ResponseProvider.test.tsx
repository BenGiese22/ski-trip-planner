import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponseProvider, useResponse } from "./ResponseProvider";
import { SessionLostNotice } from "./SessionLostNotice";
import type { ClientResponse } from "@/lib/serverSession";

function response(overrides: Partial<ClientResponse> = {}): ClientResponse {
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
    ...overrides,
  };
}

/** Exposes context state and the two actions needed to drive it from a test. */
function Harness() {
  const { response: current, problems, sessionLost, lastSavedAt, update, finish } = useResponse();
  return (
    <div>
      <div data-testid="response">{current ? "present" : "null"}</div>
      <div data-testid="problems">{problems.length}</div>
      <div data-testid="session-lost">{String(sessionLost)}</div>
      <div data-testid="last-saved-at">{lastSavedAt ?? ""}</div>
      <button onClick={() => void finish()}>finish</button>
      <button onClick={() => update({ skiDays: 3 }, { immediate: true })}>update</button>
    </div>
  );
}

const renderWith = (value: ClientResponse | null) =>
  render(
    <ResponseProvider initialResponse={value}>
      <Harness />
      <SessionLostNotice />
    </ResponseProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ResponseProvider — stale-session recovery", () => {
  it("clears response and problems, and flips sessionLost, when a background write 404s", async () => {
    const fetchMock = vi
      .fn()
      // finish() hits a 422 first, populating `problems` with something to clear later.
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            problems: [{ field: "destinationRanking", message: "Rank at least one destination." }],
          }),
          { status: 422, headers: { "content-type": "application/json" } },
        ),
      )
      // Then the identity cookie's row turns out to be gone.
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "No response found for this browser. Start with the intake form." }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: "finish" }));
    await waitFor(() => expect(screen.getByTestId("problems")).toHaveTextContent("1"));
    expect(screen.getByTestId("session-lost")).toHaveTextContent("false");
    expect(screen.queryByText(/start fresh below/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "update" }));

    await waitFor(() => expect(screen.getByTestId("session-lost")).toHaveTextContent("true"));
    expect(screen.getByTestId("response")).toHaveTextContent("null");
    expect(screen.getByTestId("problems")).toHaveTextContent("0");
    expect(screen.getByText(/start fresh below/i)).toBeVisible();
  });
});

describe("ResponseProvider — finish() updates the save timestamp", () => {
  it("bumps lastSavedAt on a successful finish even with nothing else pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ response: response({ submittedAt: "2027-01-01T00:00:00Z" }) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    renderWith(response());

    expect(screen.getByTestId("last-saved-at")).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: "finish" }));

    await waitFor(() => expect(screen.getByTestId("last-saved-at")).not.toHaveTextContent(""));
  });
});
