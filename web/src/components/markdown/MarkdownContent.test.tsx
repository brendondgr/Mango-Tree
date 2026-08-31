import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";

afterEach(cleanup);

const SOURCE = [
  "# Heading",
  "",
  "Some **bold** text and `inline code`.",
  "",
  "```python",
  'print("hi")',
  "```",
].join("\n");

describe("MarkdownContent", () => {
  // The renderer is behind React.lazy, so a broken dynamic import would leave
  // the fallback on screen forever with nothing thrown. These assertions are
  // the difference between "the chunk split" and "the chunk split and the
  // content still arrives".
  it("resolves the lazy renderer and renders markdown", async () => {
    render(<MarkdownContent content={SOURCE} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Heading" })).toBeTruthy();
    });

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(document.querySelector("pre code")).toBeTruthy();
  });

  it("shows the source as readable text before the chunk arrives", () => {
    // Synchronously, only the Suspense fallback has rendered. It must show the
    // content rather than a spinner or nothing — markdown degrades legibly, so
    // a reader is never left with a blank bubble.
    render(<MarkdownContent content="**important** message" />);
    expect(screen.getByText(/important/)).toBeTruthy();
  });

  it("renders math without throwing", async () => {
    render(<MarkdownContent content={"Inline $x^2$ math."} />);
    await waitFor(() => {
      expect(document.querySelector(".katex")).toBeTruthy();
    });
  });

  it("still highlights the languages that were explicitly registered", async () => {
    // rehype-highlight's default `common` set was replaced with an explicit
    // language map to cut ~130kB; this asserts the ones we kept still work.
    render(
      <MarkdownContent content={"```typescript\nconst x: number = 1;\n```"} />,
    );
    await waitFor(() => {
      expect(document.querySelector("code .hljs-keyword")).toBeTruthy();
    });
  });
});
