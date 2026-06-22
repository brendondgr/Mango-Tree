// Frontend-only SAMPLE inbox. Lets the UI demonstrate differentiation,
// density, and the open view before any real account is configured. This data
// is never persisted and never sent to the API — it is clearly labelled "Sample"
// in the UI. Configure a real account in Settings to see live mail.

import type { MailAccount, MailMessage } from "@/types/mailbox";

export const SAMPLE_ACCOUNTS: MailAccount[] = [
  {
    id: "sample-work",
    provider: "gmail",
    display_name: "Work",
    email: "you@company.com",
    enabled: true,
    credential_ref: "SAMPLE",
    status: "ok",
    use_graph: false,
    imap_host: null,
    imap_port: null,
    smtp_host: null,
    smtp_port: null,
    has_credential: true,
  },
  {
    id: "sample-personal",
    provider: "yahoo",
    display_name: "Personal",
    email: "you@yahoo.com",
    enabled: true,
    credential_ref: "SAMPLE",
    status: "ok",
    use_graph: false,
    imap_host: null,
    imap_port: null,
    smtp_host: null,
    smtp_port: null,
    has_credential: true,
  },
  {
    id: "sample-team",
    provider: "m365",
    display_name: "Team",
    email: "you@contoso.com",
    enabled: true,
    credential_ref: "SAMPLE",
    status: "ok",
    use_graph: false,
    imap_host: null,
    imap_port: null,
    smtp_host: null,
    smtp_port: null,
    has_credential: true,
  },
];

interface Seed {
  account: string; // sample account id
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  body: string;
}

const EMAIL: Record<string, string> = {
  "sample-work": "you@company.com",
  "sample-personal": "you@yahoo.com",
  "sample-team": "you@contoso.com",
};

const SEEDS: Seed[] = [
  {
    account: "sample-work",
    from: "Priya Nair <priya.nair@company.com>",
    subject: "Q3 planning deck — review before Friday",
    snippet: "I dropped the latest revenue model into the shared drive. Can you sanity-check the Q3 targets…",
    date: "2026-06-22T08:42:00Z",
    unread: true,
    body: "Hi,\n\nI dropped the latest revenue model into the shared drive. Can you sanity-check the Q3 targets on slide 14 before the Friday review? The growth assumptions changed after last week's call.\n\nThanks,\nPriya",
  },
  {
    account: "sample-team",
    from: "GitHub <notifications@github.com>",
    subject: "[mango-tree] CI passed on main",
    snippet: "All checks have passed for commit c855ae2 — accounts + messages DRF API + docs.",
    date: "2026-06-22T07:15:00Z",
    unread: true,
    body: "All checks have passed.\n\nRepository: mango-tree\nBranch: main\nCommit: c855ae2 — accounts + messages DRF API + docs\n\nView the run: https://github.com/example/mango-tree/actions",
  },
  {
    account: "sample-personal",
    from: "Maya Fitness <hello@mayafitness.app>",
    subject: "Your weekly summary is ready 🏃",
    snippet: "You logged 4 workouts this week and beat your distance goal by 12%. Nice work!",
    date: "2026-06-21T18:03:00Z",
    unread: false,
    body: "Great week!\n\nYou logged 4 workouts and beat your weekly distance goal by 12%.\n\nKeep the streak going.\n— The Maya Fitness team",
  },
  {
    account: "sample-work",
    from: "Daniel Osei <daniel.osei@company.com>",
    subject: "Re: Customer escalation — Acme account",
    snippet: "Looped in support. They'll have a workaround posted within the hour, full fix ships Thursday.",
    date: "2026-06-21T14:30:00Z",
    unread: false,
    body: "Looped in support. They'll have a workaround posted within the hour, and the full fix ships Thursday.\n\nI'll keep the thread updated.\n\nDaniel",
  },
  {
    account: "sample-team",
    from: "Sofia Romano <sofia.romano@contoso.com>",
    subject: "Lunch & learn: vector search internals",
    snippet: "Booking the big room for Thursday 12:30. I'll cover embeddings, ANN indexes, and our reranker.",
    date: "2026-06-20T16:50:00Z",
    unread: true,
    body: "Hi team,\n\nBooking the big room for Thursday 12:30. I'll walk through embeddings, ANN indexes, and how our reranker fits in. Bring questions.\n\nSofia",
  },
  {
    account: "sample-personal",
    from: "Riverside Books <orders@riversidebooks.com>",
    subject: "Your order has shipped",
    snippet: "Order #44182 is on its way and should arrive Tuesday. Track your package any time.",
    date: "2026-06-20T09:12:00Z",
    unread: false,
    body: "Good news — order #44182 has shipped and should arrive Tuesday.\n\n1× \"The Pragmatic Programmer\"\n\nTrack your package: https://example.com/track/44182",
  },
  {
    account: "sample-work",
    from: "Calendar <calendar-notification@company.com>",
    subject: "Invitation: Design sync @ Mon 10:00",
    snippet: "Recurring weekly. Agenda: inbox density modes, account differentiation, open-message view.",
    date: "2026-06-19T22:05:00Z",
    unread: false,
    body: "You have been invited to: Design sync\n\nWhen: Monday 10:00–10:45 (recurring weekly)\nWhere: Room 4 / video link\n\nAgenda:\n- inbox density modes\n- account differentiation\n- open-message view",
  },
  {
    account: "sample-personal",
    from: "Mom <mom@familymail.com>",
    subject: "Sunday dinner?",
    snippet: "Are you coming over Sunday? Bring the photos from the trip if you found them.",
    date: "2026-06-19T19:40:00Z",
    unread: false,
    body: "Hi sweetheart,\n\nAre you coming over Sunday? Bring the photos from the trip if you found them — Dad wants to see the mountain ones.\n\nLove, Mom",
  },
  {
    account: "sample-team",
    from: "Status <status@cloudprovider.com>",
    subject: "Resolved: elevated latency in us-east-1",
    snippet: "Between 02:10 and 03:40 UTC some requests saw elevated latency. The issue is fully resolved.",
    date: "2026-06-18T04:02:00Z",
    unread: false,
    body: "Incident resolved.\n\nBetween 02:10 and 03:40 UTC, a subset of requests in us-east-1 experienced elevated latency. Root cause was a degraded load balancer node, now replaced. No data was lost.",
  },
  {
    account: "sample-work",
    from: "Lena Barak <lena.barak@company.com>",
    subject: "Offsite logistics + headcount",
    snippet: "Final headcount is 28. I've held rooms at the harbor hotel; need your dietary preferences by Wed.",
    date: "2026-06-17T11:25:00Z",
    unread: false,
    body: "Hi all,\n\nFinal headcount is 28. I've held rooms at the harbor hotel. Please send dietary preferences by Wednesday so catering can finalize.\n\nLena",
  },
];

function toMessage(seed: Seed, index: number): MailMessage {
  return {
    uid: String(1000 - index),
    message_id: `<sample-${index}@mango.local>`,
    provider: SAMPLE_ACCOUNTS.find((a) => a.id === seed.account)?.provider ?? "gmail",
    account: EMAIL[seed.account] ?? seed.account,
    subject: seed.subject,
    from: seed.from,
    to: EMAIL[seed.account] ?? "",
    date: seed.date,
    snippet: seed.snippet,
    flags: seed.unread ? [] : ["\\Seen"],
    unread: seed.unread,
    body_text: seed.body,
    body_html: null,
  };
}

export type InboxMessage = MailMessage & { accountId: string };

const ALL: InboxMessage[] = SEEDS.map((seed, i) => ({
  ...toMessage(seed, i),
  accountId: seed.account,
}));

export function sampleMessagesFor(accountId: string | "all"): InboxMessage[] {
  const rows = accountId === "all" ? ALL : ALL.filter((m) => m.accountId === accountId);
  return [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
}
