# Python 接口树

`ChatDemo` 是用于验证 Python 包发布流程的最小模板，目前不提供业务服务或外部 API 调用。

## 包入口

```python
from chatdemo import __version__
from chatdemo.cli import main
from chatdemo.config import ChatdemoConfig
```

## 已实现接口

```text
chatdemo
├── __init__.py     # 导出 __version__
├── cli.py          # Click 入口：帮助、版本与命令树
└── config.py       # ChatEnv 配置模板与无网络副作用的 schema 检查
```

`ChatdemoConfig` 通过 `chatenv.configs` 注册。模板中的配置字段不表示已经实现外部服务；当前无需配置密钥即可运行版本和命令树命令。

## 扩展约定

- 实质能力放在可导入的 Python 函数或类中，CLI 保持薄入口。
- 文档签名与实际代码保持一致。
- 凭据和运行态会话留在受控配置存储中，不写入源码或输出。
