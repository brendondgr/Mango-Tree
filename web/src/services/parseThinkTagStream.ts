const THINK_OPEN = ["<", "think", ">"].join("");
const THINK_CLOSE = ["<", "/", "think", ">"].join("");

export interface ThinkTagSplit {
  thinking: string;
  content: string;
}

/**
 * Incrementally splits model output that embeds reasoning inside
 * XML-style think tags from the visible response content.
 */
export class ThinkTagStreamSplitter {
  private buffer = "";
  private inThinkBlock = false;
  private thinking = "";
  private content = "";

  push(chunk: string): ThinkTagSplit {
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (this.inThinkBlock) {
        const closeIdx = this.buffer.indexOf(THINK_CLOSE);
        if (closeIdx === -1) {
          const partial = this.buffer;
          this.buffer = "";
          this.thinking += partial;
          break;
        }

        this.thinking += this.buffer.slice(0, closeIdx);
        this.buffer = this.buffer.slice(closeIdx + THINK_CLOSE.length);
        this.inThinkBlock = false;
        continue;
      }

      const openIdx = this.buffer.indexOf(THINK_OPEN);
      if (openIdx === -1) {
        const safeLen = Math.max(
          0,
          this.buffer.length - (THINK_OPEN.length - 1),
        );
        if (safeLen > 0) {
          this.content += this.buffer.slice(0, safeLen);
          this.buffer = this.buffer.slice(safeLen);
        }
        break;
      }

      this.content += this.buffer.slice(0, openIdx);
      this.buffer = this.buffer.slice(openIdx + THINK_OPEN.length);
      this.inThinkBlock = true;
    }

    return { thinking: this.thinking, content: this.content };
  }

  finish(): ThinkTagSplit {
    if (this.buffer.length > 0) {
      if (this.inThinkBlock) {
        this.thinking += this.buffer;
      } else {
        this.content += this.buffer;
      }
      this.buffer = "";
    }

    return { thinking: this.thinking, content: this.content };
  }
}
