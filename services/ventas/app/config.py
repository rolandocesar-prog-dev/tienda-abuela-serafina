from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "ventas"
    database_url: str

    # URLs de servicios dependientes
    catalog_url: str = "http://catalog:8000"
    almacen_url: str = "http://almacen:8000"
    pagos_url: str = "http://pagos:8000"
    facturacion_url: str = "http://facturacion:8000"

    # Timeout (segundos) para llamadas HTTP a otros servicios
    http_timeout: float = 5.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
