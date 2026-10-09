# CLI 树

```text
chatdemo
+-- --help                 # 显示帮助
+-- --version              # 输出版本
+-- --tree                 # 注册命令与参数树
+-- --tree-brief           # 简明命令树
+-- --home PATH            # 指定目录注册表位置
+-- list [--json-output]   # 列出内置和自定义作品
+-- add DIRECTORY         # 注册含 index.html 的静态目录
+-- remove SLUG           # 取消自定义作品注册，保留源文件
+-- serve                 # 启动 HTTP 画廊
+-- export DESTINATION    # 导出到空目录
```

## 目录管理

| 命令 | 必要输入 | 效果 |
| --- | --- | --- |
| `list` | 无 | 列出作品；`--json-output` 输出结构化元数据 |
| `add DIRECTORY` | `--slug`、`--title` | 注册公开素材目录；可加 `--description` |
| `remove SLUG` | 自定义作品标识 | 仅取消注册；不能移除内置作品 |

```bash
chatdemo --home ./catalog add ./public --slug my-demo --title 我的作品
chatdemo --home ./catalog list --json-output
chatdemo --home ./catalog remove my-demo
```

slug 使用小写字母、数字和单个连字符。目录必须含 `index.html`，禁止隐藏素材或符号链接。必填输入缺失直接返回非零状态；注册和移除不修改源文件。服务启动时读取目录，更新目录后重启服务。

## 浏览和部署

| 命令 | 参数 | 默认行为 |
| --- | --- | --- |
| `serve` | `--host`、`--port` | 监听 `127.0.0.1:8769`；不提供账户认证 |
| `export DESTINATION` | 空的输出目录 | 完整画廊、元数据和所有静态资源 |

```bash
chatdemo serve --port 8769
chatdemo export ./site-output
```

如需局域网访问，显式指定 `--host 0.0.0.0`。只注册可以公开的素材；目录下所有非隐藏静态文件可被访问。导出不会覆盖已有目录内容，使用相对链接支持站点子路径。公网发布由静态平台负责，`export` 不创建远端部署。

`add`、`remove` 和 `export` 支持 ChatStyle 的 `-i/-I` 交互模式。TTY 下缺失可恢复输入时自动询问；`-I` 或 `CHATARCH_AUTO_PROMPT=0` 禁用自动询问，缺失输入返回非零状态。输入从参数和交互模式进入同一套目录/标识验证。
