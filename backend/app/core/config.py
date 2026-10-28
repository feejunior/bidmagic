from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    postgres_user: str
    postgres_password: str
    postgres_db: str
    app_db_user: str
    app_db_password: str
    db_host: str = "localhost"
    db_port: int = 5433

    def _url(self, username: str, password: str) -> URL:
        return URL.create(
            "postgresql+psycopg",
            username=username,
            password=password,
            host=self.db_host,
            port=self.db_port,
            database=self.postgres_db,
        )

    @property
    def database_url(self) -> URL:
        return self._url(self.app_db_user, self.app_db_password)

    @property
    def migration_database_url(self) -> URL:
        return self._url(self.postgres_user, self.postgres_password)


settings = Settings()
