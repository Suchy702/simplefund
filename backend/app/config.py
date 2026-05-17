from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_password: str
    supabase_jwt_secret: str

    class Config:
        env_file = ".env"


settings = Settings()
