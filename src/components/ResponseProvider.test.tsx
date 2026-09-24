import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponseProvider, useResponse } from "./ResponseProvider";
import { AUTOSAVE_DELAY_MS } from "@/hooks/useAutosave";
import { SessionLostNotice } from "./SessionLostNotice";
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

/** Exposes context state and the actions needed to drive it from a test. */
function Harness() {
  const {
    response: current,
    problems,
    sessionLost,
    status,
    lastSavedAt,
    decline,
    reconsidering,
    declinedOnly,
    update,
    setAvailability,
    finish,
    startResponse,
    reconsider,
    declineTrip,
    undoDecline,
  } = useResponse();
  const [finishMessage, setFinishMessage] = useState("");
  const [finishResult, setFinishResult] = useState("");
  return (
    <div>
      <div data-testid="response">{current ? "present" : "null"}</div>
      <div data-testid="ski-days">{current?.skiDays ?? ""}</div>
      <div data-testid="submitted-at">{current?.submittedAt ?? ""}</div>
      <div data-testid="finish-message">{finishMessage}</div>
      <div data-testid="finish-result">{finishResult}</div>
      <div data-testid="problems">{problems.length}</div>
      <div data-testid="session-lost">{String(sessionLost)}</div>
      <div data-testid="status">{status}</div>
      <div data-testid="last-saved-at">{lastSavedAt ?? ""}</div>
      <div data-testid="decline">{decline ? "present" : "null"}</div>
      <div data-testid="reconsidering">{String(reconsidering)}</div>
      <div data-testid="declined-only">{String(declinedOnly)}</div>
      <button
        onClick={() =>
          void finish().then((result) => {
            setFinishMessage(result.message ?? "");
            setFinishResult(result.ok ? "ok" : "failed");
          })
        }
      >
        finish
      </button>
      <button onClick={() => update({ skiDays: 3 }, { immediate: true })}>update</button>
      <button onClick={() => update({ skiDays: 1 })}>update-debounced</button>
      <button onClick={() => setAvailability([{ date: "2027-01-15", status: "available" }])}>
        set-availability
      </button>
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
        start-response
      </button>
      <button onClick={() => reconsider()}>reconsider</button>
      <button onClick={() => void declineTrip({ reason: "can't make it" })}>decline-trip</button>
      <button onClick={() => void undoDecline()}>undo-decline</button>
    </div>
  );
}

const renderWith = (value: ClientResponse | null, decline: ClientDecline | null = null) =>
  render(
    <ResponseProvider initialResponse={value} initialDecline={decline}>
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

describe("ResponseProvider — decline state", () => {
  it("startResponse success clears decline and reconsidering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ response: response() }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    renderWith(null, { name: "Jamie Rivera" });

    expect(screen.getByTestId("decline")).toHaveTextContent("present");

    fireEvent.click(screen.getByRole("button", { name: "reconsider" }));
    expect(screen.getByTestId("reconsidering")).toHaveTextContent("true");

    fireEvent.click(screen.getByRole("button", { name: "start-response" }));

    await waitFor(() => expect(screen.getByTestId("decline")).toHaveTextContent("null"));
    expect(screen.getByTestId("reconsidering")).toHaveTextContent("false");
  });

  it("undoDecline success clears decline and sends a DELETE to /api/declines", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWith(response(), { name: "Jamie Rivera" });

    expect(screen.getByTestId("decline")).toHaveTextContent("present");

    fireEvent.click(screen.getByRole("button", { name: "undo-decline" }));

    await waitFor(() => expect(screen.getByTestId("decline")).toHaveTextContent("null"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/declines",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("undoDecline treats a 404 (already undone elsewhere) as success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "No \"can't make it\" on file for this browser." }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWith(response(), { name: "Jamie Rivera" });
    expect(screen.getByTestId("decline")).toHaveTextContent("present");

    fireEvent.click(screen.getByRole("button", { name: "undo-decline" }));

    await waitFor(() => expect(screen.getByTestId("decline")).toHaveTextContent("null"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/declines",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("clears decline too when a background write 404s", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: "No response found for this browser. Start with the intake form." }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    renderWith(response(), { name: "Jamie Rivera" });
    expect(screen.getByTestId("decline")).toHaveTextContent("present");

    fireEvent.click(screen.getByRole("button", { name: "update" }));

    await waitFor(() => expect(screen.getByTestId("session-lost")).toHaveTextContent("true"));
    expect(screen.getByTestId("decline")).toHaveTextContent("null");
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const callsTo = (fetchMock: ReturnType<typeof vi.fn>, url: string) =>
  fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url);

describe("ResponseProvider — finish() and unsaved edits", () => {
  it("finish does not POST when a pending write has failed", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/respondents" && init?.method === "PATCH") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(json({ response: response({ submittedAt: "2027-01-01T00:00:00Z" }) }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: "update" }));
    fireEvent.click(screen.getByRole("button", { name: "finish" }));

    await waitFor(() =>
      expect(screen.getByTestId("finish-message")).toHaveTextContent(/haven't saved yet/i),
    );
    expect(callsTo(fetchMock, "/api/respondents/finish")).toHaveLength(0);
  });

  it("finish keeps an edit made while the request is in flight", async () => {
    let resolveFinish!: (res: Response) => void;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/respondents/finish") {
        return new Promise<Response>((r) => (resolveFinish = r));
      }
      return Promise.resolve(json({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWith(response({ skiDays: 2 }));

    fireEvent.click(screen.getByRole("button", { name: "finish" }));
    await waitFor(() => expect(callsTo(fetchMock, "/api/respondents/finish")).toHaveLength(1));

    // The optimistic update lands while /finish is still out.
    fireEvent.click(screen.getByRole("button", { name: "update" }));
    expect(screen.getByTestId("ski-days")).toHaveTextContent("3");

    resolveFinish(json({ response: response({ skiDays: 2, submittedAt: "2027-01-01T00:00:00Z" }) }));

    await waitFor(() =>
      expect(screen.getByTestId("submitted-at")).toHaveTextContent("2027-01-01T00:00:00Z"),
    );
    expect(screen.getByTestId("ski-days")).toHaveTextContent("3");
  });
});

const notFound = () =>
  json({ error: "No response found for this browser. Start with the intake form." }, 404);

describe("ResponseProvider — a 404'd write is not a save", () => {
  it("a 404'd autosave is not reported as saved", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(notFound())));

    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: "update" }));

    await waitFor(() => expect(screen.getByTestId("session-lost")).toHaveTextContent("true"));
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("last-saved-at")).toHaveTextContent(/^$/);
  });

  it("session loss clears the other hook's pending write", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(notFound()));
    vi.stubGlobal("fetch", fetchMock);

    renderWith(response());

    // A debounced PATCH is queued under the old cookie...
    fireEvent.click(screen.getByRole("button", { name: "update-debounced" }));
    // ...then an immediate availability write discovers the row is gone.
    fireEvent.click(screen.getByRole("button", { name: "set-availability" }));

    await waitFor(() => expect(screen.getByTestId("session-lost")).toHaveTextContent("true"));
    await new Promise((r) => setTimeout(r, AUTOSAVE_DELAY_MS + 100));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ResponseProvider — recovering from a lost session", () => {
  it("startResponse after session loss clears the notice", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ response: response() }, 201));
    vi.stubGlobal("fetch", fetchMock);

    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: "update" }));
    await waitFor(() => expect(screen.getByTestId("session-lost")).toHaveTextContent("true"));

    fireEvent.click(screen.getByRole("button", { name: "start-response" }));
    await waitFor(() => expect(screen.getByTestId("response")).toHaveTextContent("present"));

    expect(screen.getByTestId("session-lost")).toHaveTextContent("false");
    expect(screen.queryByText(/start fresh below/i)).toBeNull();
  });
});

describe("ResponseProvider — finish() on a lost session", () => {
  it("finish() routes a 404 to session-lost", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(notFound())));

    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: "finish" }));

    await waitFor(() => expect(screen.getByTestId("session-lost")).toHaveTextContent("true"));
    expect(screen.getByTestId("response")).toHaveTextContent("null");
    expect(screen.getByTestId("problems")).toHaveTextContent("0");
  });

  // Locks the #1/#4 interaction: a 404'd write is dropped, not left pending,
  // so flush reports nothing unsaved and finish goes on to its own 404 —
  // rather than stacking "haven't saved yet" on top of the session-lost notice.
  it("a 404'd autosave followed by finish shows no 'haven't saved yet'", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(notFound()));
    vi.stubGlobal("fetch", fetchMock);

    renderWith(response());

    fireEvent.click(screen.getByRole("button", { name: "update" }));
    fireEvent.click(screen.getByRole("button", { name: "finish" }));

    await waitFor(() => expect(screen.getByTestId("finish-result")).toHaveTextContent("failed"));
    expect(callsTo(fetchMock, "/api/respondents/finish")).toHaveLength(1);
    expect(screen.getByTestId("finish-message")).toHaveTextContent(/^$/);
    expect(screen.getByTestId("session-lost")).toHaveTextContent("true");
    expect(screen.getByText(/start fresh below/i)).toBeVisible();
  });
});
