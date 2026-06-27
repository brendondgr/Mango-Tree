import { describe, expect, it } from "vitest";

import {
  cleanPlainText,
  linkifySegments,
  sanitizeEmailHtml,
} from "@mailbox/utils/renderEmail";

describe("sanitizeEmailHtml — active content", () => {
  it("removes <script> elements", () => {
    const { html } = sanitizeEmailHtml('<p>hi</p><script>steal()</script>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("steal()");
  });

  it("strips inline event handlers", () => {
    const { html } = sanitizeEmailHtml('<a href="#" onclick="evil()">x</a>');
    expect(html.toLowerCase()).not.toContain("onclick");
  });

  it("neutralizes javascript: URLs", () => {
    const { html } = sanitizeEmailHtml('<a href="javascript:evil()">x</a>');
    expect(html).not.toContain("javascript:");
  });

  it("opens links in a new tab safely", () => {
    const { html } = sanitizeEmailHtml('<a href="https://example.com">link</a>');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noopener");
    // a link is navigation, not a remote resource load — it stays.
    expect(html).toContain("https://example.com");
  });
});

describe("sanitizeEmailHtml — remote content gate", () => {
  it("blocks remote images by default and flags hadRemote", () => {
    const { html, hadRemote } = sanitizeEmailHtml(
      '<img src="http://track.example/pixel.gif">',
    );
    expect(hadRemote).toBe(true);
    expect(html).not.toContain("track.example/pixel.gif");
  });

  it("loads remote images once the user opts in", () => {
    const { html, hadRemote } = sanitizeEmailHtml(
      '<img src="http://cdn.example/photo.jpg">',
      { allowRemote: true },
    );
    expect(hadRemote).toBe(false);
    expect(html).toContain("http://cdn.example/photo.jpg");
  });

  it("keeps inline data: images (not remote)", () => {
    const data = "data:image/png;base64,AAAA";
    const { html, hadRemote } = sanitizeEmailHtml(`<img src="${data}">`);
    expect(hadRemote).toBe(false);
    expect(html).toContain(data);
  });

  it("strips @import and remote url() from <style>", () => {
    const { html, hadRemote } = sanitizeEmailHtml(
      "<style>@import url(http://evil/x.css); body{background:url(http://evil/p.png)}</style>",
    );
    expect(hadRemote).toBe(true);
    expect(html).not.toContain("@import");
    expect(html).not.toContain("evil/p.png");
  });
});

describe("cleanPlainText", () => {
  it("removes zero-width/invisible spacer characters", () => {
    const mangled = "Resources‌ ‌ ‌‌from ProFellow";
    const cleaned = cleanPlainText(mangled);
    expect(cleaned).not.toMatch(/[​‌‍⁠﻿]/);
    expect(cleaned).toContain("Resources");
    expect(cleaned).toContain("ProFellow");
  });

  it("collapses runs of blank lines", () => {
    expect(cleanPlainText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("linkifySegments", () => {
  it("splits bare URLs into link segments", () => {
    const segs = linkifySegments("see https://example.com/path now");
    const link = segs.find((s) => s.href);
    expect(link?.href).toBe("https://example.com/path");
  });

  it("drops trailing punctuation from a URL", () => {
    const segs = linkifySegments("go to https://example.com.");
    const link = segs.find((s) => s.href);
    expect(link?.href).toBe("https://example.com");
  });
});
