"""House rule: self-hosted logos are fine, hotlinked external images fail."""
import importlib.util
from pathlib import Path

_p = Path(__file__).resolve().parents[2] / "scripts/acceptance/house_rules.py"
_spec = importlib.util.spec_from_file_location("house_rules", _p)
hr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hr)


def test_self_hosted_logo_allowed():
    for s in ('<img src="/nfl-analytics-simulator/logos/BUF.png" alt="Bills">',
              '<img alt="" src="logos/wordmarks/KC.svg">', "background:url(/logos/DET.png)",
              '<a href="https://github.com/nflverse">nflverse</a>'):
        assert not hr.HOTLINK.search(s), s


def test_hotlinked_images_fail():
    for s in ('<img src="https://a.espncdn.com/i/teamlogos/nfl/500/buf.png">',
              '<img alt="x" srcset="//static.www.nfl.com/logo.svg 2x">',
              "background-image: url('https://upload.wikimedia.org/x.svg')",
              '<image href="http://example.com/kc.png"/>'):
        assert hr.HOTLINK.search(s), s
