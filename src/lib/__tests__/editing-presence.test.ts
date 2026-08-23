import { describe, expect, it } from "vitest";
import { editorsFromPresence } from "@/lib/use-editing-presence";

const entry = (receipt_id: string, who: string) => ({ receipt_id, who });

describe("editorsFromPresence", () => {
  it("groups other volunteers by receipt", () => {
    expect(
      editorsFromPresence(
        {
          a: [entry("r1", "Anita Deshmukh")],
          b: [entry("r1", "Ram Joshi")],
          c: [entry("r2", "Ram Joshi")],
        },
        "Sanket Sonmali",
      ),
    ).toEqual({
      r1: ["Anita Deshmukh", "Ram Joshi"],
      r2: ["Ram Joshi"],
    });
  });

  it("never reports you to yourself", () => {
    expect(
      editorsFromPresence({ a: [entry("r1", "Sanket Sonmali")] }, "Sanket Sonmali"),
    ).toEqual({});
  });

  it("counts one person in two tabs once", () => {
    expect(
      editorsFromPresence(
        { a: [entry("r1", "Ram Joshi")], b: [entry("r1", "Ram Joshi")] },
        "Me",
      ),
    ).toEqual({ r1: ["Ram Joshi"] });
  });

  it("ignores anyone with no receipt open", () => {
    expect(
      editorsFromPresence(
        { a: [{ receipt_id: "", who: "Ram Joshi" }] },
        "Me",
      ),
    ).toEqual({});
  });

  it("survives a malformed entry rather than throwing", () => {
    expect(
      editorsFromPresence(
        // A client on an older build may track a different shape.
        { a: [undefined as unknown as { receipt_id: string; who: string }] },
        "Me",
      ),
    ).toEqual({});
  });

  it("is empty when nobody is present", () => {
    expect(editorsFromPresence({}, "Me")).toEqual({});
  });
});
