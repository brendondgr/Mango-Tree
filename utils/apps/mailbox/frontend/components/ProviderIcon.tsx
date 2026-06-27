// Brand provider marks for account/message differentiation. Rendered inside an
// outlined badge (see `.mailbox-provider` in mailbox.css) so each account is
// told apart by a colored OUTLINE plus its provider logo — not a colored dot.

import { Mail } from "lucide-react";

interface IconProps {
  className?: string;
}

function GmailMark({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 49.4 512 399.42"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Gmail"
    >
      <g fill="none" fillRule="evenodd">
        <g fillRule="nonzero">
          <path fill="#4285f4" d="M34.91 448.818h81.454V251L0 163.727V413.91c0 19.287 15.622 34.91 34.91 34.91z" />
          <path fill="#34a853" d="M395.636 448.818h81.455c19.287 0 34.909-15.622 34.909-34.909V163.727L395.636 251z" />
          <path fill="#fbbc04" d="M395.636 99.727V251L512 163.727v-46.545c0-43.142-49.25-67.782-83.782-41.891z" />
        </g>
        <path fill="#ea4335" d="M116.364 251V99.727L256 204.455 395.636 99.727V251L256 355.727z" />
        <path fill="#c5221f" fillRule="nonzero" d="M0 117.182v46.545L116.364 251V99.727L83.782 75.291C49.25 49.4 0 74.04 0 117.18z" />
      </g>
    </svg>
  );
}

function MicrosoftMark({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Microsoft"
    >
      <path fill="#F1511B" d="M121.666 121.666H0V0h121.666z" />
      <path fill="#80CC28" d="M256 121.666H134.335V0H256z" />
      <path fill="#00ADEF" d="M121.663 256.002H0V134.336h121.663z" />
      <path fill="#FBBC09" d="M256 256.002H134.335V134.336H256z" />
    </svg>
  );
}

function YahooMark({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Yahoo"
    >
      <rect width="256" height="256" rx="48" fill="#6001D2" />
      <path
        fill="#fff"
        d="M70 70h34l24 44 24-44h34l-41 72v44h-34v-44z"
      />
      <circle cx="180" cy="176" r="18" fill="#fff" />
    </svg>
  );
}

/** A provider's brand mark. Gmail and Microsoft use the official logos; Exchange
 *  is a Microsoft product so it reuses that mark; Yahoo gets a simple wordmark.
 *  Unknown providers fall back to a neutral mail glyph. Size via `className`. */
export function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  switch (provider) {
    case "gmail":
      return <GmailMark className={className} />;
    case "m365":
    case "exchange":
      return <MicrosoftMark className={className} />;
    case "yahoo":
      return <YahooMark className={className} />;
    default:
      return <Mail className={className} aria-hidden />;
  }
}
