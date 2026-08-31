"""Owner-defined LLM providers, stored on the ``default`` database.

The platform ships a set of built-in provider *kinds* (see
``utils/shared/llm/services/registry.py``), but the owner is meant to be able to
add, edit and remove concrete endpoints entirely from the settings UI — point at
a GPU box on the LAN, paste an Anthropic key, switch the default — without
editing a file or restarting the server. That is what this table holds.

**On storing the key.** It is stored in plaintext in ``data/`` alongside every
other database this platform keeps, which is gitignored and sits on the owner's
own machine. That is the same trust boundary as ``.env``, and pretending
otherwise with reversible obfuscation would be worse than being explicit. The
key is never returned by the API — only a masked hint — and providers can
instead name an environment variable via ``api_key_env`` if the owner prefers to
keep secrets out of the database entirely.
"""

from __future__ import annotations

from django.db import models


class LlmProvider(models.Model):
    """One configured endpoint the owner can select in the composer."""

    #: Stable identifier used by the API and stored in chat sessions.
    slug = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=120)

    #: Which adapter drives it. Validated against the registry's known kinds
    #: rather than a DB-level choices list, so adding an adapter does not
    #: require a migration.
    kind = models.CharField(max_length=32)

    base_url = models.CharField(max_length=500, blank=True)

    #: Set by the owner through the settings UI. Never serialised back out.
    api_key = models.CharField(max_length=500, blank=True)

    #: Alternative to `api_key`: read the secret from this environment variable
    #: at call time, so it can stay in .env.
    api_key_env = models.CharField(max_length=120, blank=True)

    #: Preselection hint only. Discovery is the source of truth for what exists,
    #: and the registry falls back to the first discovered model if this one has
    #: gone away.
    default_model = models.CharField(max_length=200, blank=True)

    #: Normalised generation defaults (temperature, max_tokens,
    #: reasoning_effort) applied unless a request overrides them.
    params = models.JSONField(default=dict, blank=True)

    enabled = models.BooleanField(default=True)

    #: A local box that is switched off must fail fast; local generation itself
    #: can legitimately take minutes. One timeout cannot be both.
    connect_timeout = models.FloatField(default=5.0)
    timeout = models.FloatField(default=180.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "mango_llm"
        ordering = ["label"]

    def __str__(self) -> str:  # pragma: no cover - debug aid
        return f"{self.label} ({self.kind})"

    @property
    def has_key(self) -> bool:
        return bool(self.api_key or self.api_key_env)

    def key_hint(self) -> str:
        """A masked hint, safe to send to the browser.

        Enough to tell two keys apart when rotating one, not enough to use.
        """
        if self.api_key_env:
            return f"env:{self.api_key_env}"
        if not self.api_key:
            return ""
        tail = self.api_key[-4:] if len(self.api_key) >= 8 else ""
        return f"…{tail}" if tail else "set"

    def to_dict(self) -> dict:
        """Serialise for the API. The key itself is never included."""
        return {
            "slug": self.slug,
            "label": self.label,
            "kind": self.kind,
            "base_url": self.base_url,
            "default_model": self.default_model,
            "params": self.params or {},
            "enabled": self.enabled,
            "connect_timeout": self.connect_timeout,
            "timeout": self.timeout,
            "has_key": self.has_key,
            "key_hint": self.key_hint(),
            "source": "owner",
        }
