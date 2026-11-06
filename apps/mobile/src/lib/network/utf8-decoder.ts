// Hermes does not guarantee a global TextDecoder, so streamed bytes are decoded
// here. Multibyte sequences split across chunks are buffered until complete.

function sequenceLength(lead: number): number {
  if (lead < 0x80) return 1;
  if (lead >= 0xc2 && lead <= 0xdf) return 2;
  if (lead >= 0xe0 && lead <= 0xef) return 3;
  if (lead >= 0xf0 && lead <= 0xf4) return 4;
  return 0; // invalid lead byte
}

function decodeBytes(bytes: number[]): string {
  let out = "";
  let index = 0;
  while (index < bytes.length) {
    const lead = bytes[index];
    const length = sequenceLength(lead);
    if (length === 0) {
      out += "\uFFFD";
      index += 1;
      continue;
    }
    if (index + length > bytes.length) {
      out += "\uFFFD";
      break;
    }
    let codePoint = length === 1 ? lead : lead & (0xff >> (length + 1));
    let valid = true;
    for (let offset = 1; offset < length; offset += 1) {
      const next = bytes[index + offset];
      if ((next & 0xc0) !== 0x80) {
        valid = false;
        break;
      }
      codePoint = (codePoint << 6) | (next & 0x3f);
    }
    if (!valid) {
      out += "\uFFFD";
      index += 1;
      continue;
    }
    if (
      (length === 2 && codePoint < 0x80) ||
      (length === 3 && codePoint < 0x800) ||
      (length === 4 && (codePoint < 0x10000 || codePoint > 0x10ffff)) ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      out += "\uFFFD";
      index += 1;
      continue;
    }
    out += String.fromCodePoint(codePoint);
    index += length;
  }
  return out;
}

export class Utf8Decoder {
  private pending: number[] = [];

  decode(chunk: Uint8Array): string {
    if (chunk.length === 0) return "";
    const bytes = this.pending.concat(Array.from(chunk));
    this.pending = [];
    let cut = bytes.length;
    for (let offset = 1; offset <= 4 && offset <= bytes.length; offset += 1) {
      const index = bytes.length - offset;
      const lead = bytes[index];
      const length = sequenceLength(lead);
      if (length <= 1) continue;
      cut = index + length > bytes.length ? index : bytes.length;
      break;
    }
    if (cut < bytes.length) this.pending = bytes.slice(cut);
    return decodeBytes(bytes.slice(0, cut));
  }

  finish(): string {
    const remainder = this.pending;
    this.pending = [];
    return remainder.length ? decodeBytes(remainder) : "";
  }
}
