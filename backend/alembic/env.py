import os
from logging.config import fileConfig

import app.models  # noqa: F401 - ensures all models are registered with Base.metadata
from alembic import context
from app.models.base import Base
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

load_dotenv()

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

db_password = os.environ["DB_PASSWORD"]
config.set_main_option(
    "sqlalchemy.url",
    f"postgresql://postgres.obkzgwevtmiyxycajpnw:{db_password}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
