import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeclinedPanel } from "./DeclinedPanel";
import { IntakeForm } from "./IntakeForm";
import { ResponseProvider } from "./ResponseProvider";
import type { ClientDecline } from "@/lib/serverSession";

function renderWith(decline: ClientDecline | null) {
  return render(
    <ResponseProvider initialResponse={null} initialDecline={decline}>
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
