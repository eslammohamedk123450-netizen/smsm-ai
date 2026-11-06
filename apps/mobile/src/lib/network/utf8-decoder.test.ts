import { Utf8Decoder } from "./utf8-decoder";

const encoder = new TextEncoder();

describe("Utf8Decoder", () => {
  it("decodes single-byte and Arabic text across one call", () => {
    const decoder = new Utf8Decoder();
    expect(decoder.decode(encoder.encode("نص عربي"))).toBe("نص عربي");
  });

  it("buffers a multibyte character split across chunks", () => {
    const decoder = new Utf8Decoder();
    const bytes = encoder.encode("😀");
    expect(decoder.decode(bytes.slice(0, 2))).toBe("");
    expect(decoder.decode(bytes.slice(2))).toBe("😀");
    expect(decoder.finish()).toBe("");
  });

  it("preserves text before an incomplete trailing sequence", () => {
    const decoder = new Utf8Decoder();
    const bytes = encoder.encode("a😀");
    expect(decoder.decode(bytes.slice(0, 3))).toBe("a");
    expect(decoder.decode(bytes.slice(3))).toBe("😀");
  });

  it("replaces a truncated sequence at stream end", () => {
    const decoder = new Utf8Decoder();
    const bytes = encoder.encode("😀");
    expect(decoder.decode(bytes.slice(0, 3))).toBe("");
    expect(decoder.finish()).toBe("\uFFFD");
  });
});