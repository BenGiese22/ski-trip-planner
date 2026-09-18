import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResponseProvider } from "./ResponseProvider";
import { IntakeForm } from "./IntakeForm";

describe("IntakeForm", () => {
  it("hides the start button when the initial load failed, since a row may already exist", () => {
    render(
      <ResponseProvider initialResponse={null} loadFailed>
        <IntakeForm />
      </ResponseProvider>,
    );
    expect(screen.queryByRole("button", { name: /start my response/i })).toBeNull();
  });

  it("shows the start button normally for a genuine first-time visitor", () => {
    render(
      <ResponseProvider initialResponse={null}>
        <IntakeForm />
      </ResponseProvider>,
    );
    expect(screen.getByRole("button", { name: /start my response/i })).toBeVisible();
  });
});
