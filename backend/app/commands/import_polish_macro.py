"""Import official NBP reference-rate history and GUS monthly CPI year over year.

Run from backend: python -m app.commands.import_polish_macro --output /tmp/macro.json
Use --input /tmp/macro.json to import a saved source report without downloading.
Both datasets are validated before any writes and committed together.
"""

import argparse
import json
from pathlib import Path

from app.database import SessionLocal
from app.scrapers.polish_macro import MacroData, fetch_macro_data
from app.services.polish_macro import store_macro_data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input", type=Path, help="Import a saved validated JSON report"
    )
    parser.add_argument(
        "--output", type=Path, help="Save source report before DB import"
    )
    args = parser.parse_args()
    data = (
        MacroData.model_validate_json(args.input.read_text(encoding="utf-8"))
        if args.input
        else fetch_macro_data()
    )
    if args.output is not None:
        args.output.write_text(data.model_dump_json(indent=2), encoding="utf-8")
    with SessionLocal.begin() as db:
        counts = store_macro_data(db, data)
    print(
        json.dumps(
            {
                "stored_and_verified": counts,
                "nbp_from": str(
                    min(row.effective_from for row in data.reference_rates)
                ),
                "nbp_latest_change": str(
                    max(row.effective_from for row in data.reference_rates)
                ),
                "inflation_from": str(min(row.month for row in data.inflation)),
                "inflation_through": str(max(row.month for row in data.inflation)),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
