"""house_rules logo ban: only manifest-listed teams/<ABBR>/{logo,wordmark}.png may ship."""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

_p = Path(__file__).resolve().parents[2] / "scripts/acceptance/house_rules.py"
_spec = importlib.util.spec_from_file_location("house_rules_logos", _p)
hr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hr)

ALLOWED = {"teams/KC/logo.png", "teams/KC/wordmark.png"}


def test_manifest_team_files_allowed():
    assert hr.logo_file_allowed("teams/KC/logo.png", ALLOWED)
    assert hr.logo_file_allowed("teams/KC/wordmark.png", ALLOWED)


def test_logo_files_elsewhere_still_fail():
    for rel in ("logo.png", "img/logo.png", "teams/logo.png", "teams/KC/extra/logo.png",
                "teams/KC/logo.svg", "teams/BUF/logo.png", "other/KC/logo.png"):
        assert not hr.logo_file_allowed(rel, ALLOWED), rel


def test_img_tags():
    assert hr.bad_logo_imgs('<img src="/teams/KC/logo.png" alt="KC logo">') == []
    assert hr.bad_logo_imgs('<img src="/base/teams/KC/wordmark.png" class="logo">') == []
    assert hr.bad_logo_imgs('<img src="/img/logo.png">')
    assert hr.bad_logo_imgs('<img src="https://a.espncdn.com/i/teamlogos/nfl/500/kc.png">')
    assert hr.bad_logo_imgs('<img class="teamlogo" src="/x/kc.png">')


def test_built_site_scan(tmp_path):
    data = {"quiz": {"items": []}, "scenarios": [], "plays": [], "wpPoints": []}
    (tmp_path / "site.json").write_text(json.dumps(data))
    site = tmp_path / "out"
    (site / "teams/KC").mkdir(parents=True)
    (site / "teams/KC/logo.png").write_bytes(b"x")
    (site / "teams/manifest.json").write_text(json.dumps(
        {"teams": {"KC": {"logo": {"path": "/teams/KC/logo.png"}, "wordmark": {"path": "/teams/KC/wordmark.png"}}}}))
    (site / "index.html").write_text('<html><body><img src="/teams/KC/logo.png" alt="KC logo"></body></html>')
    run = lambda: subprocess.run([sys.executable, str(_p), str(tmp_path / "site.json"), str(site)],
                                 capture_output=True, text=True)
    out = run()
    assert "logo:" not in out.stdout + out.stderr
    (site / "assets").mkdir()
    (site / "assets/logo.png").write_bytes(b"x")
    out = run()
    assert "logo: built site ships assets/logo.png" in out.stdout + out.stderr
