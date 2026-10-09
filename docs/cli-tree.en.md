# CLI tree

```text
chatdemo
+-- --help                 # Show help
+-- --version              # Print version
+-- --tree                 # Registered commands and parameters
+-- --tree-brief           # Compact tree
+-- --home PATH            # Local catalog location
+-- list [--json-output]   # List bundled and registered demos
+-- add DIRECTORY         # Register a directory containing index.html
+-- remove SLUG           # Unregister a custom demo, preserving its source
+-- serve                 # Start an HTTP gallery
+-- export DESTINATION    # Export to an empty directory
```

## Catalog management

| Command | Required input | Result |
| --- | --- | --- |
| `list` | None | List demos; `--json-output` emits structured metadata |
| `add DIRECTORY` | `--slug`, `--title` | Register public assets; optional `--description` |
| `remove SLUG` | Custom slug | Unregister only; bundled demos cannot be removed |

```bash
chatdemo --home ./catalog add ./public --slug my-demo --title "My demo"
chatdemo --home ./catalog list --json-output
chatdemo --home ./catalog remove my-demo
```

Slugs use lowercase letters, digits and single hyphens. Directories require `index.html` and may not contain hidden assets or symbolic links. Missing required inputs fail without prompting. Registration and removal preserve sources. Restart the server after catalog changes.

## Browsing and deployment

| Command | Options | Default behavior |
| --- | --- | --- |
| `serve` | `--host`, `--port` | Bind `127.0.0.1:8769`; no account authentication |
| `export DESTINATION` | Empty destination | Complete gallery, metadata and static assets |

```bash
chatdemo serve --port 8769
chatdemo export ./site-output
```

Use `--host 0.0.0.0` explicitly for LAN access. Every non-hidden file under registered roots is public. Exports refuse to overwrite existing content and use relative links for subpath hosting. A static platform owns public deployment; `export` creates no remote service.

`add`, `remove` and `export` use ChatStyle `-i/-I` interaction. Missing recoverable inputs prompt in a TTY. `-I` or `CHATARCH_AUTO_PROMPT=0` disables automatic prompting and fails on missing inputs. Both paths use the same catalog validation.
