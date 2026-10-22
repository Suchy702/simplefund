from pydantic_settings import BaseSettings
from sqlalchemy import URL


class Settings(BaseSettings):
    db_password: str
    supabase_jwt_secret: str
    supabase_url: str = "https://obkzgwevtmiyxycajpnw.supabase.co"
    db_host: str = "aws-1-eu-central-1.pooler.supabase.com"
    db_port: int = 5432
    db_user: str = "postgres.obkzgwevtmiyxycajpnw"
    db_name: str = "postgres"

    @property
    def database_url(self) -> URL:
        return URL.create(
            "postgresql+psycopg2",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
            query={"sslmode": "require", "connect_timeout": "10"},
        )

    class Config:
        env_file = ".env"


# BaseSettings loads required values from environment variables and .env.
settings = Settings()  # ty: ignore[missing-argument]
