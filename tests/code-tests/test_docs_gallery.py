from pathlib import Path
import runpy


ROOT = Path(__file__).resolve().parents[2]


def test_docs_hook_exports_bundled_assets_and_accepts_i18n_repeated_event(tmp_path):
    hook = runpy.run_path(str(ROOT / "scripts/docs_gallery.py"))["on_post_build"]
    config = {"site_dir": str(tmp_path)}
    hook(config)
    hook(config)
    assert (tmp_path / "web/index.html").is_file()
    assert (tmp_path / "web/demos/mechanical-atelier/vendor/three.module.js").is_file()
    assert not (tmp_path / ".bundled-only").exists()


def test_source_distribution_includes_docs_hook():
    assert "recursive-include scripts *.py" in (ROOT / "MANIFEST.in").read_text()
