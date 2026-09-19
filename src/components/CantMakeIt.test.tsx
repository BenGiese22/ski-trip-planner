import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CantMakeIt } from "./CantMakeIt";
import { ResponseProvider } from "./ResponseProvider";
import type { ClientDecline } from "@/lib/serverSession";

function renderWith(decline: ClientDecline | null = null) {
  return render(
    <ResponseProvider initialResponse={null} initialDecline={decline}>
      <CantMakeIt />
    </ResponseProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: /can.t make it this time/i });

function expand() {
  fireEvent.click(trigger());
}

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ decline: { name: "Jamie Rivera" } }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CantMakeIt", () => {
  it("starts collapsed, with nothing but the link", () => {
    renderWith();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Your name")).toBeNull();
  });

  it("reveals name, email and reason once expanded", () => {
    renderWith();
    expand();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Your name")).toBeVisible();
    expect(screen.getByLabelText("Email (optional)")).toBeVisible();
    expect(screen.getByLabelText(/anything you want ben to know/i)).toBeVisible();
    expect(screen.getByText("0/200")).toBeVisible();
  });

  it("counts the reason against its 200-character limit", () => {
    renderWith();
    expand();

    fireEvent.change(screen.getByLabelText(/anything you want ben to know/i), {
      target: { value: "Away that weekend" },
    });
    expect(screen.getByText("17/200")).toBeVisible();
  });

  it("refuses a blank name client-side, without a request", () => {
    const fetchMock = stubFetch();
    renderWith();
    expand();

    fireEvent.click(screen.getByRole("button", { name: "Let Ben know" }));

    expect(screen.getByText(/please tell us your name/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("collapses on Never mind without saving anything", () => {
    const fetchMock = stubFetch();
    renderWith();
    expand();

    fireEvent.click(screen.getByRole("button", { name: /never mind/i }));

    expect(screen.queryByLabelText("Your name")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the decline and then steps aside for the declined panel", async () => {
    const fetchMock = stubFetch();
    renderWith();
    expand();

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Jamie Rivera" },
    });
    fireEvent.change(screen.getByLabelText(/anything you want ben to know/i), {
      target: { value: "Away that weekend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Let Ben know" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /can.t make it this time/i })).toBeNull(),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/declines");
    expect(init.method).toBe("POST");
    // The blank email is left out rather than sent as "" — an empty string
    // would land in the column as if it were an answer.
    expect(JSON.parse(init.body)).toEqual({
      name: "Jamie Rivera",
      reason: "Away that weekend",
    });
  });

  it("surfaces a failed request instead of pretending it saved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    renderWith();
    expand();

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Jamie Rivera" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Let Ben know" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.getByLabelText("Your name")).toHaveValue("Jamie Rivera");
  });

  it("renders nothing once a decline is already on file", () => {
    const { container } = renderWith({ name: "Jamie Rivera" });
    expect(container).toBeEmptyDOMElement();
  });
});
