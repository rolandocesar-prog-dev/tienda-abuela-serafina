from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "compras"
    database_url: str

    # URLs de servicios dependientes
    almacen_url: str = "http://almacen:8000"
    pagos_url: str = "http://pagos:8000"

    http_timeout: float = 5.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
