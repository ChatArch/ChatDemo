from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_release_is_tag_only_with_version_and_main_guards():
    workflow = (ROOT / ".github/workflows/publish.yml").read_text()
    assert 'tags:\n      - "v*"' in workflow
    assert "workflow_dispatch" not in workflow
    assert "id-token: write" in workflow
    assert "pypa/gh-action-pypi-publish@release/v1" in workflow
    assert "Verify tag matches package version" in workflow
    assert "git fetch --no-tags origin main:refs/remotes/origin/main" in workflow
    assert 'git merge-base --is-ancestor "${GITHUB_SHA}" refs/remotes/origin/main' in workflow
    assert "environment:" not in workflow
    for token_setting in ("secrets.PYPI", "TWINE_PASSWORD", "password:"):
        assert token_setting not in workflow


def test_interface_docs_have_both_languages():
    for filename in ("interface-tree.md", "interface-tree.en.md"):
        text = (ROOT / "docs" / filename).read_text()
        assert "ChatdemoConfig" in text
        assert "__version__" in text
