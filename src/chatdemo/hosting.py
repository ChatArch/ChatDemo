"""A small static demo catalog, exporter and HTTP server."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from functools import partial
from html import escape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit


BUILTINS = Path(__file__).parent / "web"
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")


@dataclass(frozen=True)
class Demo:
    slug: str
    title: str
    description: str
    directory: Path
    builtin: bool = False

    @property
    def url_path(self) -> str:
        return f"/demos/{self.slug}/"

    def summary(self) -> dict:
        return {"slug": self.slug, "title": self.title, "description": self.description,
                "url_path": self.url_path, "builtin": self.builtin}


def default_home() -> Path:
    return Path.home() / ".chatarch" / "chatdemo"


def _validate_slug(slug: str) -> None:
    if not SLUG.fullmatch(slug):
        raise ValueError("Slug must contain lowercase letters, digits and single hyphens.")


def _validate_directory(directory: Path) -> Path:
    if directory.is_symlink():
        raise ValueError("Demo directories must not be symbolic links.")
    directory = directory.resolve()
    if not (directory / "index.html").is_file():
        raise ValueError("Demo directory must contain index.html.")
    for path in directory.rglob("*"):
        if path.is_symlink():
            raise ValueError("Demo assets must not contain symbolic links.")
        if path.name.startswith("."):
            raise ValueError("Demo assets must not contain hidden files or directories.")
    return directory


def _read_registry(home: Path) -> list[dict]:
    path = home / "catalog.json"
    if not path.exists():
        return []
    entries = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(entries, list):
        raise ValueError("Catalog must be a JSON list.")
    for entry in entries:
        if (not isinstance(entry, dict) or
                not all(isinstance(entry.get(key), str) for key in ("slug", "title", "directory")) or
                not isinstance(entry.get("description", ""), str)):
            raise ValueError("Catalog entries require string slug, title, directory and description fields.")
    return entries


def _write_registry(home: Path, entries: list[dict]) -> None:
    home.mkdir(parents=True, exist_ok=True)
    staged = home / "catalog.json.new"
    staged.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    staged.replace(home / "catalog.json")


def list_demos(home: Path | None = None) -> list[Demo]:
    """Return bundled demos and explicitly registered external directories."""
    home = Path(home) if home is not None else default_home()
    demos = [Demo("mechanical-atelier", "机巧 · 三种机械设计",
                  "六瓣星轮、双摆擒纵与行星差速：可旋转、拆解、暂停和单步观察。",
                  BUILTINS / "mechanical-atelier", True)]
    for entry in _read_registry(home):
        _validate_slug(entry["slug"])
        if any(demo.slug == entry["slug"] for demo in demos):
            raise ValueError("Catalog contains a duplicate or reserved slug.")
        demos.append(Demo(entry["slug"], entry["title"], entry.get("description", ""),
                          _validate_directory(Path(entry["directory"]))))
    return demos


def add_demo(directory: Path, slug: str, title: str, *, description: str = "",
             home: Path | None = None) -> Demo:
    """Register an explicit static directory; source files are not copied or modified."""
    home = Path(home) if home is not None else default_home()
    _validate_slug(slug)
    if any(demo.slug == slug for demo in list_demos(home)):
        raise ValueError(f"Demo '{slug}' already exists.")
    demo = Demo(slug, title, description, _validate_directory(Path(directory)))
    entry = asdict(demo)
    entry.pop("builtin")
    entry["directory"] = str(demo.directory)
    _write_registry(home, [*_read_registry(home), entry])
    return demo


def remove_demo(slug: str, *, home: Path | None = None) -> None:
    """Unregister a custom demo without deleting any source files."""
    home = Path(home) if home is not None else default_home()
    _validate_slug(slug)
    entries = _read_registry(home)
    remaining = [entry for entry in entries if entry["slug"] != slug]
    if len(entries) == len(remaining):
        raise ValueError("Custom demo not found; bundled demos cannot be removed.")
    _write_registry(home, remaining)


def gallery_html(demos: list[Demo]) -> str:
    cards = "".join(
        f'<a class="card" href=".{demo.url_path}"><span class="tag">'
        f'{"BUILT-IN" if demo.builtin else "WORKSPACE"}</span><h2>{escape(demo.title)}</h2>'
        f'<p>{escape(demo.description)}</p><span class="open">打开演示 &rarr;</span></a>'
        for demo in demos
    )
    template = (BUILTINS / "gallery.html").read_text(encoding="utf-8")
    return template.replace("<!-- DEMO_CARDS -->", cards)


def export_site(destination: Path, *, home: Path | None = None) -> Path:
    """Export a self-contained gallery for any static host, including path prefixes."""
    destination = Path(destination).absolute()
    if destination.is_symlink():
        raise ValueError("Export destination must not be a symbolic link.")
    destination = destination.resolve()
    demos = list_demos(home)
    for demo in demos:
        _validate_directory(demo.directory)
        if destination == demo.directory or demo.directory in destination.parents:
            raise ValueError("Export destination must not be inside a demo directory.")
    if destination.exists() and any(destination.iterdir()):
        raise ValueError("Export destination must be empty; existing files are never overwritten.")
    destination.mkdir(parents=True, exist_ok=True)
    for demo in demos:
        shutil.copytree(demo.directory, destination / "demos" / demo.slug)
    (destination / "index.html").write_text(gallery_html(demos), encoding="utf-8")
    (destination / "catalog.json").write_text(
        json.dumps([demo.summary() for demo in demos], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    (destination / ".nojekyll").touch()
    return destination


class DemoRequestHandler(SimpleHTTPRequestHandler):
    """Serve only a gallery and registered public asset roots, without directory listings."""

    def __init__(self, *args, demos: list[Demo], **kwargs):
        self.demos = demos
        super().__init__(*args, **kwargs)

    def do_GET(self):
        self._respond(head=False)

    def do_HEAD(self):
        self._respond(head=True)

    def _respond(self, *, head: bool):
        path = unquote(urlsplit(self.path).path)
        if path == "/":
            body = gallery_html(self.demos).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if not head:
                self.wfile.write(body)
            return
        parts = path.split("/")
        if (len(parts) < 4 or parts[1] != "demos" or
                any(part in (".", "..") or part.startswith(".") for part in parts[1:] if part)):
            self.send_error(404)
            return
        demo = next((item for item in self.demos if item.slug == parts[2]), None)
        if demo is None or demo.directory.is_symlink():
            self.send_error(404)
            return
        relative = Path(*parts[3:])
        root = demo.directory.resolve()
        target = root / relative
        if any(parent.is_symlink() for parent in [target, *target.parents] if parent != root and root in parent.parents):
            self.send_error(404)
            return
        target = target.resolve()
        if root != target and root not in target.parents:
            self.send_error(404)
            return
        if target.is_dir():
            if not path.endswith("/"):
                parsed = urlsplit(self.path)
                location = parsed.path + "/" + ("?" + parsed.query if parsed.query else "")
                self.send_response(301)
                self.send_header("Location", location)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            target /= "index.html"
        if not target.is_file():
            self.send_error(404)
            return
        self._asset = target
        if head:
            super().do_HEAD()
        else:
            super().do_GET()

    def translate_path(self, path):
        return str(self._asset)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def create_server(*, host: str = "127.0.0.1", port: int = 8769,
                  home: Path | None = None) -> ThreadingHTTPServer:
    """Build an HTTP server. Call serve_forever(), then server_close() to run it."""
    return ThreadingHTTPServer((host, port), partial(DemoRequestHandler, demos=list_demos(home)))
