import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the hero heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /colorado ski weekend/i }),
    ).toBeInTheDocument();
  });

  it("renders all three destination names", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Steamboat Springs" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Summit County/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Winter Park" })).toBeInTheDocument();
  });
});
