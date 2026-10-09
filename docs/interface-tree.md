# Python 接口树

```text
chatdemo
+-- __version__
+-- cli.main                       # Click 适配层
+-- config.ChatdemoConfig          # 既有 ChatEnv schema 入口
+-- hosting.Demo                   # 作品元数据
+-- hosting.list_demos(home=None)
+-- hosting.add_demo(directory, slug, title, description="", home=None)
+-- hosting.remove_demo(slug, home=None)
+-- hosting.export_site(destination, home=None)
+-- hosting.create_server(host="127.0.0.1", port=8769, home=None)
```

## 可复用调用

```python
from pathlib import Path
from chatdemo.hosting import add_demo, export_site, list_demos, create_server

home = Path("./catalog")
add_demo(Path("./public"), "my-demo", "我的作品", home=home)
for demo in list_demos(home):
    print(demo.summary())
export_site(Path("./site-output"), home=home)

server = create_server(home=home, port=8769)
try:
    server.serve_forever()
finally:
    server.server_close()
```

目录函数遇到不合法输入抛出 `ValueError`；文件与网络错误保留 `OSError`。`Demo.summary()` 不输出源目录的本机路径。CLI 是这些接口的薄适配层。`ChatdemoConfig` 仍注册到 ChatEnv；Web 功能不读取模板 API 密钥。
