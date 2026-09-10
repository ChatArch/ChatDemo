# Python Interface Tree

`ChatDemo` is a minimal template for verifying Python package releases. It does not implement business services or external API calls.

## Package entry points

```python
from chatdemo import __version__
from chatdemo.cli import main
from chatdemo.config import ChatdemoConfig
```

## Implemented interfaces

```text
chatdemo
├── __init__.py     # Exports __version__
├── cli.py          # Click entry: help, version, and command trees
└── config.py       # ChatEnv template and network-free schema check
```

`ChatdemoConfig` is registered through `chatenv.configs`. Its placeholder field does not imply an implemented external service. Version and command-tree commands do not require a configured API key.

## Extension contract

- Put substantive capabilities in importable Python functions or classes and keep CLI entry points thin.
- Keep documented signatures aligned with the implementation.
- Keep credentials and runtime sessions in the approved configuration store, never in source or command output.
