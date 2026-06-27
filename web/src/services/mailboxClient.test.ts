import { afterEach, describe, expect, it, vi } from "vitest";

import { listMessages, setCredential, startOAuth, testAccount } from "./mailboxClient";

function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ authorize_url: "https://provider/authorize" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("mailboxClient URLs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("startOAuth hits /api/mailbox/oauth/start/ (NOT under accounts/)", async () => {
    const fetchMock = mockFetch();
    await startOAuth("gmail");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mailbox/oauth/start/?provider=gmail");
  });

  it("testAccount hits the account-scoped test endpoint", async () => {
    const fetchMock = mockFetch();
    await testAccount("acc_1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mailbox/accounts/acc_1/test/");
  });

  it("setCredential PUTs the account credential endpoint with {value}", async () => {
    const fetchMock = mockFetch();
    await setCredential("acc_1", "app-pw");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mailbox/accounts/acc_1/credential/");
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ value: "app-pw" }));
  });

  it("listMessages defaults to limit=all so the whole folder loads", async () => {
    const fetchMock = mockFetch();
    await listMessages("acc_1");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/mailbox/accounts/acc_1/messages/?folder=INBOX&limit=all",
    );
  });

  it("listMessages forwards a numeric cap when given one", async () => {
    const fetchMock = mockFetch();
    await listMessages("acc_1", "INBOX", 100);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/mailbox/accounts/acc_1/messages/?folder=INBOX&limit=100",
    );
  });
});
