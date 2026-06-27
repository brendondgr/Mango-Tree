import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmailBody } from "@mailbox/components/EmailBody";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("EmailBody", () => {
  it("renders HTML in a locked-down sandboxed iframe", () => {
    render(<EmailBody html="<p>Hello</p>" text={null} />);
    const frame = screen.getByTitle("Email message") as HTMLIFrameElement;
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain("Hello");
  });

  it("gates remote content behind an explicit user action", () => {
    render(<EmailBody html='<img src="http://track.example/p.gif">' text={null} />);

    // blocked initially: banner shown, remote URL absent from the frame
    expect(screen.getByText(/blocked to protect your privacy/i)).toBeTruthy();
    let frame = screen.getByTitle("Email message") as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).not.toContain("track.example");

    // user opts in -> banner clears and the remote URL is now allowed to load
    fireEvent.click(screen.getByRole("button", { name: /display content/i }));
    expect(screen.queryByText(/blocked to protect your privacy/i)).toBeNull();
    frame = screen.getByTitle("Email message") as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).toContain("track.example");
  });

  it("falls back to linkified plain text when there is no HTML", () => {
    render(<EmailBody html={null} text="visit https://example.com today" />);
    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
