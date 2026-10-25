from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.polish_macro import NbpReferenceRate, PolishInflation
from app.scrapers.polish_macro import MacroData


def store_macro_data(db: Session, data: MacroData) -> dict[str, int]:
    """Atomically upsert and compare every imported field; caller owns transaction."""
    imported_at = datetime.now(timezone.utc)
    counts = {}
    for model, entries, key in (
        (NbpReferenceRate, data.reference_rates, "effective_from"),
        (PolishInflation, data.inflation, "month"),
    ):
        rows = [entry.model_dump() | {"imported_at": imported_at} for entry in entries]
        for offset in range(0, len(rows), 250):
            batch = rows[offset : offset + 250]
            statement = insert(model).values(batch)
            db.execute(
                statement.on_conflict_do_update(
                    index_elements=[getattr(model, key)],
                    set_={
                        name: statement.excluded[name]
                        for name in batch[0]
                        if name != key
                    },
                )
            )
        actual = {
            getattr(row, key): row
            for row in db.scalars(
                select(model).where(getattr(model, key).in_([row[key] for row in rows]))
            )
        }
        for expected in rows:
            saved = actual.get(expected[key])
            if saved is None or any(
                getattr(saved, name) != value for name, value in expected.items()
            ):
                raise RuntimeError(f"Stored {model.__tablename__} differs from source")
        counts[model.__tablename__] = len(rows)
    return counts
