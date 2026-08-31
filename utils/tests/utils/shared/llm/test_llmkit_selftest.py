"""Run the vendored llmkit self-test as part of the normal suite.

`utils/scripts/llmkit_selftest.py` spins up mock HTTP servers that reproduce the
exact response shapes of vLLM, llama.cpp and Ollama, then exercises discovery,
normalization, chat, streaming and tool calling against them — 130 checks, no
keys, no network, no GPU.

It lives as a script rather than a pytest module because its `test_*` functions
take base-URL arguments, which pytest would try to satisfy as fixtures. This
wrapper is the CI gate: it is what makes an accidental regression in any adapter
fail `uv run pytest`.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

SELFTEST = (
    Path(__file__).resolve().parents[4] / "scripts" / "llmkit_selftest.py"
)


def _load_selftest():
    spec = importlib.util.spec_from_file_location("llmkit_selftest", SELFTEST)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["llmkit_selftest"] = module
    spec.loader.exec_module(module)
    return module


def test_selftest_script_exists() -> None:
    assert SELFTEST.is_file(), f"missing {SELFTEST}"


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
def test_llmkit_selftest_passes(
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_selftest()
    # main() parses sys.argv rather than taking parameters.
    monkeypatch.setattr(sys, "argv", ["llmkit_selftest.py", "--quiet"])
    exit_code = module.main()
    output = capsys.readouterr().out
    assert exit_code == 0, f"llmkit self-test failed:\n{output}"
    assert "checks passed" in output
