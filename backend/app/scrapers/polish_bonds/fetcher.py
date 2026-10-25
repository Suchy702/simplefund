from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from io import BytesIO
from urllib.request import Request, urlopen

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.scrapers.polish_bonds.parser import (
    BASE_URL,
    TERMS,
    issue_letter_url,
    parse_catalog,
    parse_issue,
    sale_month,
)
from app.scrapers.polish_bonds.schemas import Issue, ScrapeError, ScrapeResult

CATALOG_URLS = (
    f"{BASE_URL}/listy-emisyjne/",
    f"{BASE_URL}/archiwum-listow-emisyjnych/",
)
OFFER_PATHS = {
    "ROD": "obligacje-12-letnie-rod",
    "ROS": "obligacje-6-letnie-ros",
    "TOS": "obligacje-3-letnie-tos",
    "COI": "obligacje-4-letnie-coi",
    "EDO": "obligacje-10-letnie-edo",
    "DOR": "obligacje-2-letnie-dor",
    "ROR": "obligacje-roczne-ror",
    "OTS": "obligacje-3-miesieczne-ots",
}


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": "SimpleFund/1.0"})
    with urlopen(request, timeout=30) as response:
        if "text/html" not in response.headers.get("Content-Type", ""):
            raise ValueError("Expected an HTML document")
        return response.read().decode(response.headers.get_content_charset() or "utf-8")


def fetch_pdf(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "SimpleFund/1.0"})
    with urlopen(request, timeout=30) as response:
        content = response.read()
    if not content.startswith(b"%PDF-"):
        raise ValueError("Expected a PDF document")
    return content


def scrape_issues(
    *,
    since: date | None = None,
    families: set[str] | None = None,
    through_series: str | None = None,
    latest: bool = False,
    fetch: Callable[[str], str] = fetch_html,
    fetch_letter: Callable[[str], bytes] = fetch_pdf,
    workers: int = 1,
) -> ScrapeResult:
    """Fetch supported issues newest first, including the entire boundary month.

    No range selects all available history. ``latest`` selects the newest month
    across the requested families. Source failures produce an incomplete result.
    Invalid caller parameters raise ValueError before downloading offer pages.
    """
    if not 1 <= workers <= 4:
        raise ValueError("Workers must be between 1 and 4")
    if sum((since is not None, through_series is not None, latest)) > 1:
        raise ValueError("Choose only one of since, through_series or latest")
    selected = set(TERMS) if families is None else families
    if not selected or selected - TERMS.keys():
        raise ValueError(f"Supported families: {', '.join(TERMS)}")
    if through_series is not None:
        through_series = through_series.upper()
        sale_month(through_series)
        if through_series[:3] not in selected:
            raise ValueError("Boundary series is excluded by the family filter")
    result = ScrapeResult()
    codes: set[str] = set()
    for url in CATALOG_URLS:
        try:
            codes.update(parse_catalog(fetch(url)))
        except (OSError, ValueError) as exc:
            result.errors.append(ScrapeError(source_url=url, message=str(exc)))
    if through_series is not None:
        if through_series not in codes:
            raise ValueError(f"Boundary series not found: {through_series}")
        since = sale_month(through_series)
    codes = {code for code in codes if code[:3] in selected}
    if latest and codes:
        since = max(sale_month(code) for code in codes)
    boundary = since.replace(day=1) if since is not None else None
    ordered = sorted(codes, key=lambda code: (sale_month(code), code), reverse=True)
    ordered = [
        code for code in ordered if boundary is None or sale_month(code) >= boundary
    ]

    def scrape(code: str) -> Issue | ScrapeError:
        url = f"{BASE_URL}/oferta-obligacji/{OFFER_PATHS[code[:3]]}/{code.lower()}/"
        try:
            html = fetch(url)
            try:
                return parse_issue(html, code, url)
            except ValueError:
                letter = fetch_letter(issue_letter_url(html))
                text = "\n".join(
                    page.extract_text() for page in PdfReader(BytesIO(letter)).pages
                )
                return parse_issue(html, code, url, letter_text=text)
        except (OSError, ValueError, PyPdfError) as exc:
            return ScrapeError(source_url=url, series_code=code, message=str(exc))

    executor = ThreadPoolExecutor(max_workers=workers)
    try:
        for item in executor.map(scrape, ordered):
            if isinstance(item, Issue):
                result.issues.append(item)
            else:
                result.errors.append(item)
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
    return result
