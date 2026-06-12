from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "pagos"
    database_url: str

    # Stripe (modo test). Si no se configuran, los endpoints con tarjeta
    # devolverán 503 — ver routes.py.
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
