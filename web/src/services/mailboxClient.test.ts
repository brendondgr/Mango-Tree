import { afterEach, describe, expect, it, vi } from "vitest";

import { setCredential, startOAuth, testAccount } from "./mailboxClient";

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
});
