from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "facturacion"
    database_url: str
    iva_rate: float = 0.13  # 13% IVA

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
