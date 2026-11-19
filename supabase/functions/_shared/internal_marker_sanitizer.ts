/**
 * Removes model-emitted internal marker blocks from assistant text.
 * Stateful so markers and hidden blocks split across provider chunks never leak.
 * Fail closed: if a hidden block is left unclosed, its remaining text is dropped.
 */
const HIDDEN_TAGS = ["thought", "think", "analysis", "reasoning", "scratchpad", "reflection", "chain_of_thought"] as const;
type HiddenTag = typeof HIDDEN_TAGS[number];

export class InternalMarkerSanitizer {
  private buffer = "";
  private hidden: HiddenTag | null = null;
  private readonly maxMarkerLength = Math.max(...HIDDEN_TAGS.map((tag) => tag.length)) + 4;

  push(chunk: string): string {
    if (!chunk) return "";
    this.buffer += chunk;
    return this.process(false);
  }

  finish(): string {
    return this.process(true);
  }

  private process(final: boolean): string {
    let output = "";
    while (this.buffer) {
      if (this.hidden) {
        const close = new RegExp(`</\\s*${this.hidden}\\s*>`, "i");
        const match = close.exec(this.buffer);
        if (!match) {
          if (final) this.buffer = "";
          else this.buffer = this.buffer.slice(-this.maxMarkerLength);
          break;
        }
        this.buffer = this.buffer.slice(match.index + match[0].length);
        this.hidden = null;
        continue;
      }

      let nextIndex = -1;
      let nextTag: HiddenTag | null = null;
      let nextMatch = "";
      for (const tag of HIDDEN_TAGS) {
        const open = new RegExp(`<\\s*${tag}\\s*>`, "i");
        const match = open.exec(this.buffer);
        if (match && (nextIndex < 0 || match.index < nextIndex)) {
          nextIndex = match.index;
          nextTag = tag;
          nextMatch = match[0];
        }
      }
      if (nextIndex >= 0 && nextTag) {
        output += this.buffer.slice(0, nextIndex);
        this.buffer = this.buffer.slice(nextIndex + nextMatch.length);
        this.hidden = nextTag;
        continue;
      }

      if (final) {
        output += this.buffer;
        this.buffer = "";
        break;
      }
      const safeLength = Math.max(0, this.buffer.length - this.maxMarkerLength);
      output += this.buffer.slice(0, safeLength);
      this.buffer = this.buffer.slice(safeLength);
      break;
    }
    return output;
  }
}
