/** Live mock UI showing where each semantic color token applies. */

function PreviewLabel({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

export function ColorPalettePreview() {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-md)] border border-border ring-2 ring-ring/40"
      aria-label="Color token preview"
    >
      <div className="border-b border-border bg-card px-3 py-2">
        <PreviewLabel>Card</PreviewLabel>
        <p className="text-sm font-medium text-card-foreground">Panel header</p>
      </div>

      <div className="space-y-3 bg-background p-3">
        <div>
          <PreviewLabel>Background</PreviewLabel>
          <p className="text-sm text-foreground">Page canvas area</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[var(--radius-sm)] border border-border bg-card p-2">
            <PreviewLabel>Card</PreviewLabel>
            <p className="text-xs text-card-foreground">Elevated surface</p>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-muted p-2">
            <PreviewLabel>Muted</PreviewLabel>
            <p className="text-xs text-muted-foreground">Inset / code block</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[var(--radius-pill)] bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            Secondary
          </span>
          <span className="rounded-[var(--radius-pill)] bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            Accent
          </span>
          <button
            type="button"
            className="rounded-[var(--radius-sm)] bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
          >
            Primary
          </button>
        </div>

        <div className="border-t border-border pt-2">
          <PreviewLabel>Border</PreviewLabel>
        </div>
      </div>
    </div>
  );
}
