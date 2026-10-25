import argparse
import json
import sys
from datetime import date
from hashlib import sha256
from pathlib import Path

from app.scrapers.polish_bonds import scrape_issues
from app.scrapers.polish_bonds.fetcher import fetch_html, fetch_pdf
from app.scrapers.polish_bonds.parser import TERMS


def month(value: str) -> date:
    try:
        return date.fromisoformat(f"{value}-01")
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Expected YYYY-MM") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape Polish bond issue terms")
    boundary = parser.add_mutually_exclusive_group()
    boundary.add_argument("--since", type=month, help="Inclusive sale month: YYYY-MM")
    boundary.add_argument("--through-series", help="Inclusive boundary series")
    boundary.add_argument(
        "--latest", action="store_true", help="Newest sale month only"
    )
    parser.add_argument("--families", nargs="+", choices=list(TERMS))
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=1)
    parser.add_argument(
        "--cache-dir", type=Path, help="Reuse downloaded HTML/PDF files"
    )
    args = parser.parse_args()

    def cached(url: str, *, pdf: bool = False):
        path = None
        if args.cache_dir is not None:
            args.cache_dir.mkdir(parents=True, exist_ok=True)
            suffix = ".pdf" if pdf else ".html"
            path = args.cache_dir / (sha256(url.encode()).hexdigest() + suffix)
            if path.exists():
                return path.read_bytes() if pdf else path.read_text()
        value = fetch_pdf(url) if pdf else fetch_html(url)
        if path is not None:
            temporary = path.with_suffix(path.suffix + ".tmp")
            if isinstance(value, bytes):
                temporary.write_bytes(value)
            else:
                temporary.write_text(value)
            temporary.replace(path)
        print(f"Downloaded: {url}", file=sys.stderr, flush=True)
        return value

    try:
        result = scrape_issues(
            since=args.since,
            through_series=args.through_series,
            latest=args.latest,
            families=set(args.families) if args.families else None,
            workers=args.workers,
            fetch=cached,
            fetch_letter=lambda url: cached(url, pdf=True),
        )
    except ValueError as exc:
        parser.error(str(exc))
    print(
        json.dumps(
            {**result.model_dump(mode="json"), "complete": result.complete},
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if result.complete else 1


if __name__ == "__main__":
    raise SystemExit(main())
