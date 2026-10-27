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
    assert hr.bad_logo_imgs('<img src="https://evil.example.com/teams/BUF/logo.png">')
    assert hr.bad_logo_imgs('<img src="//evil.example.com/teams/BUF/logo.png">')


def test_external_images_fail():
    for bad in ('<img src="https://evil.example.com/teams/BUF/logo.png">',
                '<img src="https://upload.wikimedia.org/kc.svg">',
                '<img alt="x" src="//cdn.example.com/a.png">',
                '<img src="/a.png" srcset="/a.png 1x, https://cdn.example.com/a@2x.png 2x">',
                '<picture><source srcset="http://x.example/a.webp"></picture>',
                '<svg><image href="https://x.example/a.png"/></svg>',
                '<svg><image xlink:href="//x.example/a.png"/></svg>',
                '.a{background:url("https://x.example/bg.png")}',
                ".a{background-image:url(//x.example/bg.jpg)}"):
        assert hr.external_images(bad), bad
    for ok in ('<img src="/teams/KC/logo.png">', '<img src="/base/teams/KC/wordmark.png" srcset="/a.png 2x">',
               '<svg><image href="/teams/KC/logo.png"/></svg>', ".a{background:url(/img/bg.png)}",
               '.a{background:url("data:image/png;base64,AAA")}',
               "@font-face{src:url(https://fonts.gstatic.com/s/x.woff2) format('woff2')}"):
        assert hr.external_images(ok) == [], ok


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
    (site / "assets/logo.png").unlink()
    (site / "kc.html").write_text('<html><body><img src="https://upload.wikimedia.org/kc.svg"></body></html>')
    (site / "x.css").write_text('.a{background:url(https://evil.example.com/teams/BUF/logo.png)}')
    out = run().stdout
    assert "external image: /kc.html" in out and "external image: /x.css" in out
