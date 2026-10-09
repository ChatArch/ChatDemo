# Python API tree

```text
chatdemo
+-- __version__
+-- cli.main                       # Click adapter
+-- config.ChatdemoConfig          # Existing ChatEnv schema
+-- hosting.Demo                   # Demo metadata
+-- hosting.list_demos(home=None)
+-- hosting.add_demo(directory, slug, title, description="", home=None)
+-- hosting.remove_demo(slug, home=None)
+-- hosting.export_site(destination, home=None)
+-- hosting.create_server(host="127.0.0.1", port=8769, home=None)
```

## Reusable calls

```python
from pathlib import Path
from chatdemo.hosting import add_demo, export_site, list_demos, create_server

home = Path("./catalog")
add_demo(Path("./public"), "my-demo", "My demo", home=home)
for demo in list_demos(home):
    print(demo.summary())
export_site(Path("./site-output"), home=home)

server = create_server(home=home, port=8769)
try:
    server.serve_forever()
finally:
    server.server_close()
```

Invalid catalog inputs raise `ValueError`; filesystem and network errors retain `OSError`. `Demo.summary()` omits local source paths. The CLI is a thin adapter. `ChatdemoConfig` remains registered with ChatEnv; Web features do not consume the template API key.
