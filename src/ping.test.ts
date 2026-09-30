import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vitest";
import { ping } from "./ping";

describe("ping", () => {
  afterEach(() => {
    clearMocks();
  });

  it("returns the display text for a reply", async () => {
    mockIPC(() => ({ echo: "hello", version: "0.1.0" }));

    expect(await ping("hello")).toBe("Quiro 0.1.0 replied: hello");
  });

  it("invokes the ping command with the message in a request", async () => {
    const calls: { cmd: string; payload: unknown }[] = [];
    mockIPC((cmd, payload) => {
      calls.push({ cmd, payload });
      return { echo: "hello", version: "0.1.0" };
    });

    await ping("hello");

    expect(calls).toEqual([
      { cmd: "ping", payload: { request: { message: "hello" } } },
    ]);
  });

  it("returns the display text for an empty ping", async () => {
    mockIPC(() => {
      throw { kind: "empty" };
    });

    expect(await ping("")).toBe("Rust rejected an empty ping");
  });

  it("returns the display text for a ping that is too long", async () => {
    mockIPC(() => {
      throw { kind: "tooLong", data: { max: 256 } };
    });

    expect(await ping("a".repeat(257))).toBe(
      "Rust rejected a ping longer than 256 characters",
    );
  });
});
