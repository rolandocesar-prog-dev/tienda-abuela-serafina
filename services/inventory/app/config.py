from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "inventory"
    database_url: str
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    product_url: str = "http://product:8000"
    jwt_secret: str = "CHANGE-ME-IN-PROD"
    jwt_algorithm: str = "HS256"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
