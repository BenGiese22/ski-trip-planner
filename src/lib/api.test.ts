import { describe, expect, it } from "vitest";
import { noSuchRespondent } from "./api";
import { IDENTITY_COOKIE } from "./session";

describe("noSuchRespondent", () => {
  it("clears the identity cookie so the next load starts clean", () => {
    const response = noSuchRespondent();

    expect(response.status).toBe(404);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${IDENTITY_COOKIE}=`);
    expect(setCookie).toMatch(/max-age=0|expires=thu, 01 jan 1970/i);
  });
});
