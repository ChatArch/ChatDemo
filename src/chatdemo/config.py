"Typed environment configuration for ChatDemo."

from chatenv import BaseEnvConfig, EnvField


class ChatdemoConfig(BaseEnvConfig):
    "ChatDemo ChatEnv configuration."

    _title = "ChatDemo Configuration"
    _aliases = ["chatdemo"]
    _storage_dir = "Chatdemo"

    @classmethod
    def test(cls) -> None:
        """Validate schema registration without external side effects."""

        print(f"Testing {cls._title}...")
        print("Schema loaded; no network test is required.")

    CHATDEMO_API_KEY = EnvField(
        "CHATDEMO_API_KEY",
        desc="API key",
        is_sensitive=True,
    )


__all__ = ["ChatdemoConfig"]
