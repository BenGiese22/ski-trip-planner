import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

describe("error boundary", () => {
  it("re-fetches the segment via retry when 'Try again' is clicked", () => {
    const retry = vi.fn();
    const reset = vi.fn();
    const error = Object.assign(new Error("db down"), { digest: "abc123" });

    // Next passes both; only `retry` re-fetches server data.
    const props = { error, retry, reset };
    render(<ErrorPage {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
});
