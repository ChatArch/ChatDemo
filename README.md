# ChatDemo

ChatDemo 是 ChatArch 的静态网页作品目录：注册现有 Web 产物，在本机打开作品，或导出可部署的完整站点。内置「机巧」展示六瓣星轮、双摆擒纵和行星差速。

| 使用场景 | 入口 |
| --- | --- |
| 本机演示作品 | `chatdemo serve` |
| 接入自己的网页 | `chatdemo add ./public --slug my-demo --title 我的作品` |
| 部署到静态主机 | `chatdemo export ./site-output` |
| 阅读使用说明 | [文档站](https://arch.gh.wzhecnu.cn/ChatDemo/) |

## 安装和运行

```bash
python -m pip install -e .
chatdemo list
chatdemo serve --port 8769
```

开发源码可用 `python -m pip install -e ".[dev,docs]"`。浏览器打开 `http://127.0.0.1:8769/`；服务默认只监听本机。新注册的目录在服务重启后生效。静态目录需要 `index.html`，不允许隐藏文件或符号链接，目录里只应保留准备公开的网页素材。

```bash
chatdemo --home ./demo-catalog add ./public --slug my-demo --title 我的作品
chatdemo --home ./demo-catalog list --json-output
chatdemo --home ./demo-catalog serve
chatdemo --home ./demo-catalog export ./site-output
chatdemo --home ./demo-catalog remove my-demo
```

导出目录必须为空；导出内容使用相对资源链接，可放在站点的子路径下。移除仅取消注册，不删除原文件。目录默认保存在 `~/.chatarch/chatdemo/catalog.json`，与 ChatEnv 凭据存储分离；Web 功能不需要 API 密钥。

## 文档和边界

- [命令树](https://arch.gh.wzhecnu.cn/ChatDemo/cli-tree/)：已实现命令与参数。
- [能力地图](https://arch.gh.wzhecnu.cn/ChatDemo/capability-map/)：托管边界与默认行为。
- [Python 接口](https://arch.gh.wzhecnu.cn/ChatDemo/interface-tree/)：可复用函数和 HTTP 服务。
- [英文版](README.en.md)。

这是静态文件服务，不执行后端、构建前端工程或提供账户认证。需要后端的应用应单独部署；公网生产服务应使用静态平台或有认证与 TLS 的反向代理。内置机械是交互视觉原型，不表示完成了真实机械制造或物理验证。

`add`、`remove` 和 `export` 支持 ChatStyle 的 `-i/-I` 交互模式。TTY 下缺失可恢复输入时自动询问；`-I` 或 `CHATARCH_AUTO_PROMPT=0` 禁用自动询问，缺失输入返回非零状态。输入从参数和交互模式进入同一套目录/标识验证。

网页托管能力位于 0.0.3 源码版本；从源码根目录安装。PyPI 已发布的 0.0.2 只含包发布示范模板，正式发布 0.0.3 后才能从 PyPI 获取网页命令。
