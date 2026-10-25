"""Import a saved scraper JSON report without downloading the sources again.

Run from backend: python -m app.commands.import_bond_issues --input report.json
Successful issues are stored atomically; source errors remain in the report.
An incomplete source report produces exit status 1 even after a partial import.
"""

import argparse
from pathlib import Path

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models.bond_series import BondSeries
from app.scrapers.polish_bonds.schemas import ScrapeResult
from app.services.bond_issues import store_issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Import validated bond issue data")
    parser.add_argument("--input", type=Path, required=True)
    args = parser.parse_args()
    report = ScrapeResult.model_validate_json(args.input.read_text())
    with SessionLocal.begin() as db:
        stored = store_issues(db, report.issues)
        codes = [issue.series_code for issue in report.issues]
        verified = db.scalar(
            select(func.count())
            .select_from(BondSeries)
            .where(BondSeries.series_code.in_(codes))
        )
        if verified != stored:
            raise RuntimeError("Stored series count does not match the report")
    print(f"Stored and verified: {stored}; source errors: {len(report.errors)}")
    return 0 if report.complete else 1


if __name__ == "__main__":
    raise SystemExit(main())
