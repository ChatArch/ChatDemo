import json
from click.testing import CliRunner
from chatdemo.cli import main


def test_catalog_and_export_commands(tmp_path):
    runner = CliRunner()
    home = ["--home", str(tmp_path / "catalog")]
    result = runner.invoke(main, [*home, "list", "--json-output"])
    assert result.exit_code == 0, result.output
    assert json.loads(result.output)[0]["slug"] == "mechanical-atelier"
    root = tmp_path / "custom"
    root.mkdir()
    (root / "index.html").write_text("custom")
    result = runner.invoke(main, [*home, "add", str(root), "--slug", "custom", "--title", "Custom"])
    assert result.exit_code == 0, result.output
    result = runner.invoke(main, [*home, "export", str(tmp_path / "export")])
    assert result.exit_code == 0, result.output
    assert (tmp_path / "export/demos/custom/index.html").is_file()
    result = runner.invoke(main, [*home, "remove", "custom"])
    assert result.exit_code == 0, result.output
    assert root.exists()


def test_missing_required_inputs_fail_without_prompt():
    result = CliRunner().invoke(main, ["add", "-I"])
    assert result.exit_code != 0
    assert "directory" in result.output


def test_tree_includes_implemented_commands():
    for option in ["--tree", "--tree-brief"]:
        result = CliRunner().invoke(main, [option])
        assert result.exit_code == 0
        for command in ["add", "export", "list", "remove", "serve"]:
            assert command in result.output
