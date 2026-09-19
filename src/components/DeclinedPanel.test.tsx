import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeclinedPanel } from "./DeclinedPanel";
import { IntakeForm } from "./IntakeForm";
import { ResponseProvider } from "./ResponseProvider";
import type { ClientDecline, ClientResponse } from "@/lib/serverSession";

function response(overrides: Partial<ClientResponse> = {}): ClientResponse {
  return {
    name: "Jamie Rivera",
    email: "jamie@example.com",
    plusOne: false,
    homeAirport: "SFO",
    skiLevel: "intermediate",
    skiDays: null,
    alreadyHasPass: false,
    gearStatus: null,
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

function renderWith(decline: ClientDecline | null, current: ClientResponse | null = null) {
  return render(
    <ResponseProvider initialResponse={current} initialDecline={decline}>
      <DeclinedPanel />
      <IntakeForm />
    </ResponseProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeclinedPanel", () => {
  it("thanks the person by first name only", () => {
    renderWith({ name: "Jamie Rivera" });
    expect(
      screen.getByRole("heading", { name: /thanks for letting ben know, jamie\./i }),
    ).toBeVisible();
  });

  it("falls back to a nameless thank-you when the name is missing", () => {
    renderWith({ name: null });
    expect(
      screen.getByRole("heading", { name: /^thanks for letting ben know\.$/i }),
    ).toBeVisible();
  });

  it("renders nothing for someone who hasn't declined", () => {
    renderWith(null);
    expect(screen.queryByRole("heading", { name: /thanks for letting ben know/i })).toBeNull();
  });

  it("hides the intake form until the person reconsiders", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWith({ name: "Jamie Rivera" });

    expect(screen.queryByLabelText("Your name")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /actually, i can make it/i }));

    // Reconsidering is a client-side reveal only — nothing is written until
    // intake is actually completed.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Your name")).toBeVisible();
    expect(screen.queryByRole("heading", { name: /thanks for letting ben know/i })).toBeNull();
  });
});

describe("DeclinedPanel — both rows, a respondent row already exists", () => {
  it("shows the everything-you'd-filled-in body, regardless of reconsidering", () => {
    renderWith({ name: "Jamie Rivera" }, response());
    expect(
      screen.getByRole("heading", { name: /thanks for letting ben know, jamie\./i }),
    ).toBeVisible();
    expect(screen.getByText(/everything you.d filled in is still here/i)).toBeVisible();
  });

  it("falls back to the response's name when the decline has none", () => {
    renderWith({ name: null }, response({ name: "Alex Chen" }));
    expect(
      screen.getByRole("heading", { name: /thanks for letting ben know, alex\./i }),
    ).toBeVisible();
  });

  it("undoes the decline with a DELETE and clears it on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWith({ name: "Jamie Rivera" }, response());

    fireEvent.click(screen.getByRole("button", { name: /actually, i can make it/i }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /thanks for letting ben know/i })).toBeNull(),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/declines");
    expect(init.method).toBe("DELETE");
  });

  it("surfaces a failed undo and leaves the button clickable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "No dice." }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderWith({ name: "Jamie Rivera" }, response());

    const button = screen.getByRole("button", { name: /actually, i can make it/i });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No dice."));
    expect(button).toBeEnabled();
    expect(
      screen.getByRole("heading", { name: /thanks for letting ben know/i }),
    ).toBeVisible();
  });
});
