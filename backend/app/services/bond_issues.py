from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.bond_series import BondSeries
from app.models.enums import InterestType
from app.scrapers.polish_bonds.schemas import Issue


def store_issues(db: Session, issues: list[Issue]) -> int:
    """Upsert validated issue terms; caller owns commit and rollback.

    Preserve created_at and foreign keys. A repeated import replaces source
    terms for the same series rather than inserting duplicate catalog entries.
    """
    rows = {}
    imported_at = datetime.now(timezone.utc)
    for issue in issues:
        row = issue.model_dump()
        row["interest_type"] = (
            InterestType.fixed
            if issue.interest_type == "fixed"
            else InterestType.variable
        )
        # Retain the legacy column's fixed-rate meaning.
        row["annual_rate"] = issue.fixed_rate_pct
        row["imported_at"] = imported_at
        if issue.series_code in rows and rows[issue.series_code] != row:
            raise ValueError(f"Conflicting duplicate series: {issue.series_code}")
        rows[issue.series_code] = row
    values = list(rows.values())
    for offset in range(0, len(values), 250):
        batch = values[offset : offset + 250]
        statement = insert(BondSeries).values(batch)
        db.execute(
            statement.on_conflict_do_update(
                index_elements=[BondSeries.series_code],
                set_={
                    key: statement.excluded[key]
                    for key in batch[0]
                    if key != "series_code"
                },
            )
        )
    return len(values)
