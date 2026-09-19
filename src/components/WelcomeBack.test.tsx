import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponseProvider, useResponse } from "./ResponseProvider";
import { WelcomeBack } from "./WelcomeBack";
import type { ClientDecline, ClientResponse } from "@/lib/serverSession";

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

const renderWith = (value: ClientResponse | null, decline: ClientDecline | null = null) =>
  render(
    <ResponseProvider initialResponse={value} initialDecline={decline}>
      <WelcomeBack />
    </ResponseProvider>,
  );

describe("WelcomeBack", () => {
  it("greets the person by first name only", () => {
    renderWith(response());
    expect(screen.getByRole("heading", { name: /welcome back, jamie\./i })).toBeVisible();
  });

  it("handles a single-word name without trailing punctuation trouble", () => {
    renderWith(response({ name: "Sam" }));
    expect(screen.getByRole("heading", { name: /welcome back, sam\./i })).toBeVisible();
  });

  it("renders nothing at all for a first-time visitor", () => {
    const { container } = renderWith(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when a decline is on file", () => {
    // DeclinedPanel owns that slot — two "we know who you are" cards at once
    // would contradict each other.
    const { container } = renderWith(response(), { name: "Jamie Rivera" });
    expect(container).toBeEmptyDOMElement();
  });

  it("counts only days the person can actually make", () => {
    renderWith(
      response({
        availability: [
          { date: "2027-01-28", status: "available" },
          { date: "2027-01-29", status: "maybe" },
          { date: "2027-01-30", status: "unavailable" },
        ],
      }),
    );
    // "maybe" still counts as a day worth knowing about; "unavailable" doesn't.
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByText(/days marked/)).toBeVisible();
  });

  it("uses the singular for exactly one day", () => {
    renderWith(
      response({ availability: [{ date: "2027-01-28", status: "available" }] }),
    );
    expect(screen.getByText(/day marked/)).toBeVisible();
    expect(screen.queryByText(/days marked/)).toBeNull();
  });

  it("says the answer is final once submitted, without implying it's locked", () => {
    renderWith(response({ submittedAt: new Date().toISOString() }));
    expect(screen.getByText(/marked your answer as final/i)).toBeVisible();
    expect(screen.getByText(/nothing's locked/i)).toBeVisible();
  });

  it("invites an unsubmitted visitor to pick up where they left off", () => {
    renderWith(response());
    expect(screen.getByText(/pick up wherever you left off/i)).toBeVisible();
  });

  it("reflects whether a plus-one is coming", () => {
    renderWith(response({ plusOne: true }));
    expect(screen.getByText("Bringing a plus-one")).toBeVisible();

    renderWith(response({ plusOne: false }));
    expect(screen.getByText("Coming solo")).toBeVisible();
  });
});

describe("WelcomeBack — first-time vs. returning", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays hidden the moment intake creates the row, not just before it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ response: response({ name: "Jamie Rivera" }) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    function StartButton() {
      const { response: current, startResponse } = useResponse();
      return (
        <>
          <div data-testid="response">{current ? "present" : "null"}</div>
          <button
            onClick={() =>
              void startResponse({
                name: "Jamie Rivera",
                email: "jamie@example.com",
                plusOne: false,
                homeAirport: "SFO",
                skiLevel: "intermediate",
              })
            }
          >
            start
          </button>
        </>
      );
    }

    render(
      <ResponseProvider initialResponse={null} initialDecline={null}>
        <StartButton />
        <WelcomeBack />
      </ResponseProvider>,
    );

    expect(screen.queryByRole("heading", { name: /welcome back/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(screen.getByTestId("response")).toHaveTextContent("present"));

    // The row now exists (this is what previously made WelcomeBack render),
    // but this is a first-time visitor completing intake, not a return visit.
    expect(screen.queryByRole("heading", { name: /welcome back/i })).toBeNull();
  });
});
