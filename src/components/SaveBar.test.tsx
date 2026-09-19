import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponseProvider } from "./ResponseProvider";
import { SaveBar } from "./SaveBar";
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

const renderWith = (value: ClientResponse | null) =>
  render(
    <ResponseProvider initialResponse={value}>
      <SaveBar />
    </ResponseProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SaveBar — Save & finish failure handling", () => {
  it("re-enables the button and shows an error when the request rejects outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: /save & finish/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save & finish/i })).toBeEnabled();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't save & finish/i);
  });

  it("re-enables the button and shows an error on a 500 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: /save & finish/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save & finish/i })).toBeEnabled();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't save & finish/i);
  });

  it("shows the server's specific message on a 503 with a JSON error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "We're doing maintenance — try again in a bit." }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: /save & finish/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save & finish/i })).toBeEnabled();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We're doing maintenance — try again in a bit.",
    );
  });

  it("still shows the incomplete-answers list on a 422 (regression)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            problems: [{ field: "destinationRanking", message: "Rank at least one destination." }],
          }),
          { status: 422, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: /save & finish/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/almost — a couple of things still need an answer/i),
      ).toBeVisible();
    });
    expect(screen.getByText("Rank at least one destination.")).toBeVisible();
    expect(screen.getByRole("button", { name: /save & finish/i })).toBeEnabled();
  });
});
