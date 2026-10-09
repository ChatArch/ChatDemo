# ChatDemo

ChatDemo registers, serves and exports static Web demonstrations. Its bundled Mechanical Atelier contains three interactive mechanisms: a Geneva wheel, a double-pendulum escapement and a planetary differential.

| Task | Entry |
| --- | --- |
| Run a local gallery | `chatdemo serve` |
| Register a Web artifact | `chatdemo add ./public --slug my-demo --title "My demo"` |
| Export for a static host | `chatdemo export ./site-output` |
| Read documentation | [Documentation](https://arch.gh.wzhecnu.cn/ChatDemo/en/) |

```bash
python -m pip install -e .
chatdemo list
chatdemo serve --port 8769
```

Open `http://127.0.0.1:8769/`. Development source can be installed with `python -m pip install -e ".[dev,docs]"`. The server binds to loopback by default. Restart it after catalog changes. A registered directory must contain `index.html` and must contain no hidden files or symbolic links. Include only assets intended for publication.

```bash
chatdemo --home ./demo-catalog add ./public --slug my-demo --title "My demo"
chatdemo --home ./demo-catalog list --json-output
chatdemo --home ./demo-catalog serve
chatdemo --home ./demo-catalog export ./site-output
chatdemo --home ./demo-catalog remove my-demo
```

Exports require an empty destination and use relative links suitable for subpath hosting. Removal unregisters a demo and preserves its source. The default catalog is `~/.chatarch/chatdemo/catalog.json`; it is application data, separate from ChatEnv credentials. No API key is required for Web hosting.

See the [CLI tree](https://arch.gh.wzhecnu.cn/ChatDemo/en/cli-tree/), [capability map](https://arch.gh.wzhecnu.cn/ChatDemo/en/capability-map/), [Python API](https://arch.gh.wzhecnu.cn/ChatDemo/en/interface-tree/) and [Chinese README](README.md).

This static server does not build frontend projects, execute backends or authenticate users. Use a static hosting platform or an authenticated TLS proxy for production. The bundled mechanisms are visual prototypes, not manufactured or physically verified machines.

`add`, `remove` and `export` use ChatStyle `-i/-I` interaction. Missing recoverable inputs prompt in a TTY. `-I` or `CHATARCH_AUTO_PROMPT=0` disables automatic prompting and fails on missing inputs. Both paths use the same catalog validation.

Web hosting is available in the 0.0.3 source version; install from its repository root. Published PyPI 0.0.2 is the release-workflow template. PyPI installation of Web commands requires the 0.0.3 release.
