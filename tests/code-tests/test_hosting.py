import json
from pathlib import Path
import threading
from urllib.error import HTTPError
from urllib.request import build_opener, ProxyHandler

urlopen = build_opener(ProxyHandler({})).open

import pytest

from chatdemo.hosting import add_demo, create_server, export_site, list_demos, remove_demo


def source(tmp_path):
    root = tmp_path / "demo"
    root.mkdir()
    (root / "index.html").write_text("custom demo")
    (root / "asset.js").write_text("console.log('asset')")
    return root


def test_register_list_remove_preserves_source(tmp_path):
    root = source(tmp_path)
    home = tmp_path / "catalog"
    demo = add_demo(root, "custom-demo", "Custom", home=home)
    assert demo.url_path == "/demos/custom-demo/"
    assert [d.slug for d in list_demos(home)] == ["mechanical-atelier", "custom-demo"]
    with pytest.raises(ValueError, match="already exists"):
        add_demo(root, "custom-demo", "Duplicate", home=home)
    with pytest.raises(ValueError, match="already exists"):
        add_demo(root, "mechanical-atelier", "Reserved", home=home)
    remove_demo("custom-demo", home=home)
    assert root.joinpath("index.html").read_text() == "custom demo"
    with pytest.raises(ValueError, match="cannot be removed"):
        remove_demo("mechanical-atelier", home=home)


@pytest.mark.parametrize("slug", ["../private", "/root", "UPPER", "a--b", "", "a/b"])
def test_reject_invalid_slug(tmp_path, slug):
    with pytest.raises(ValueError, match="Slug"):
        add_demo(source(tmp_path), slug, "Invalid", home=tmp_path / "catalog")


def test_reject_private_and_linked_assets(tmp_path):
    root = source(tmp_path)
    secret = root / ".env"
    secret.write_text("private")
    with pytest.raises(ValueError, match="hidden"):
        add_demo(root, "private", "Private", home=tmp_path / "catalog")
    secret.unlink()
    (root / "link").symlink_to(tmp_path)
    with pytest.raises(ValueError, match="symbolic"):
        add_demo(root, "linked", "Linked", home=tmp_path / "catalog")


def test_export_self_contained_and_never_overwrites(tmp_path):
    home = tmp_path / "catalog"
    root = source(tmp_path)
    add_demo(root, "custom", "<script>title</script>", home=home)
    output = export_site(tmp_path / "export", home=home)
    assert (output / "demos/custom/index.html").read_text() == "custom demo"
    assert (output / "demos/mechanical-atelier/vendor/three.core.js").is_file()
    html = (output / "index.html").read_text()
    assert 'href="./demos/custom/"' in html
    assert "&lt;script&gt;title&lt;/script&gt;" in html
    assert "directory" not in (output / "catalog.json").read_text()
    assert json.loads((output / "catalog.json").read_text())[1]["slug"] == "custom"
    with pytest.raises(ValueError, match="empty"):
        export_site(output, home=home)
    with pytest.raises(ValueError, match="inside"):
        export_site(root / "export", home=home)


def test_malformed_catalog_has_a_clear_error(tmp_path):
    (tmp_path / "catalog.json").write_text('[{"slug": "incomplete"}]')
    with pytest.raises(ValueError, match="Catalog entries"):
        list_demos(tmp_path)


def test_server_assets_head_and_private_path_boundaries(tmp_path):
    home = tmp_path / "catalog"
    root = source(tmp_path)
    add_demo(root, "custom", "Custom", home=home)
    (root / ".env").write_text("secret added after registration")
    # Server construction revalidates registered roots before listening.
    with pytest.raises(ValueError, match="hidden"):
        create_server(port=0, home=home)
    (root / ".env").unlink()
    server = create_server(port=0, home=home)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}"
    try:
        assert urlopen(url + "/").status == 200
        assert urlopen(url + "/demos/custom/").read() == b"custom demo"
        assert urlopen(url + "/demos/custom/asset.js").status == 200
        sub = root / "nested"
        sub.mkdir()
        (sub / "index.html").write_text("nested")
        response = urlopen(url + "/demos/custom/nested")
        assert response.url.endswith("/nested/")
        assert response.read() == b"nested"
        (root / "link").symlink_to(tmp_path)
        for path in ["/catalog.json", "/demos/custom/.env", "/demos/custom/%2e%2e/catalog.json",
                     "/demos/custom/link", "/demos/custom/link/catalog.json", "/demos/missing/",
                     "/demos/custom/missing/", "/demos/custom/%2fetc/passwd"]:
            with pytest.raises(HTTPError) as error:
                urlopen(url + path)
            assert error.value.code == 404
        from urllib.request import Request
        assert urlopen(Request(url + "/demos/custom/asset.js", method="HEAD")).read() == b""
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
