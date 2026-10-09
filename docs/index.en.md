# ChatDemo · Web demonstration catalog

Organize generated Web artifacts into a gallery that can be explored locally and exported for static hosting.

<div class="grid cards" markdown>

- **Explore locally**

    Run `chatdemo serve` to open the bundled mechanical prototypes.

    [Explore demonstrations](gallery.md)

- **Register your work**

    Add a static directory and give it a stable browser path.

    [Read the CLI tree](cli-tree.md)

- **Export a complete site**

    Export the gallery and its assets, then deploy with a static host.

    [Check capabilities](capability-map.md)

- **Call from Python**

    Use catalog, export and server functions without subprocesses.

    [Read the API tree](interface-tree.md)

</div>

## Quick start

```bash
python -m pip install -e .
chatdemo serve --port 8769
```

Open `http://127.0.0.1:8769/`. The default server binds to loopback; stop with Ctrl+C.

| Documentation | Contents |
| --- | --- |
| Demonstrations | Bundled interactive pages and browsing |
| CLI tree | Real commands, parameters and workflows |
| Capability map | Static serving boundaries and deployment |
| Python API tree | Importable catalog and HTTP functions |

Web hosting is available in the 0.0.3 source version; install from its repository root. Published PyPI 0.0.2 is the release-workflow template. PyPI installation of Web commands requires the 0.0.3 release.
