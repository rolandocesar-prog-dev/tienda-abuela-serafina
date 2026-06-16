from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "sales"
    database_url: str

    # URLs de servicios dependientes (consume REST de Product, Inventory, Customer).
    # Pagos y Facturacion fueron archivados en el pivote total.
    product_url: str = "http://product:8000"
    inventory_url: str = "http://inventory:8000"
    customer_url: str = "http://customer:8000"

    # Timeout (segundos) para llamadas HTTP a otros servicios
    http_timeout: float = 5.0

    # IVA aplicado a las ventas. El owner de sales decide si se calcula aquí o no.
    iva_rate: float = 0.13

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
