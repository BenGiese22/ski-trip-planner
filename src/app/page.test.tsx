import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/serverSession", () => ({
  currentRespondent: vi.fn(() => Promise.reject(new Error("connect ECONNREFUSED"))),
  loadClientResponse: vi.fn(),
}));

import Home from "./page";

describe("Home", () => {
  it("keeps the reference content readable when the database is unreachable", async () => {
    render(await Home());

    expect(
      screen.getByRole("heading", { name: /colorado ski weekend/i }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Steamboat Springs" })).toBeVisible();
    expect(screen.getByText(/load your saved answers/i)).toBeVisible();
  });
});
