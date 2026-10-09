"""Export packaged demos after MkDocs builds the documentation."""
from pathlib import Path
from chatdemo.hosting import export_site


def on_post_build(config, **kwargs):
    # Use an absent home so personal catalogs never enter published documentation.
    output = Path(config["site_dir"]) / "web"
    # i18n dispatches the hook more than once during a single clean build.
    if not output.exists():
        export_site(output, home=Path(config["site_dir"]) / ".bundled-only")
