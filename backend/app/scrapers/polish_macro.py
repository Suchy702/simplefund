"""Official Polish reference rates and monthly headline CPI year-over-year.

No database access. Download and validate complete sources before importing.
GUS index 104.1 means 4.1 percent inflation, not 104.1 percent inflation.
The GUS historical series does not provide original publication dates.
"""

import csv
import io
from datetime import date
from decimal import Decimal
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from pydantic import BaseModel, ConfigDict, Field, model_validator

NBP_HISTORY_URL = "https://static.nbp.pl/dane/stopy/stopy_procentowe_archiwum.xml"
NBP_CURRENT_URL = "https://static.nbp.pl/dane/stopy/stopy_procentowe.xml"
GUS_PAGE_URL = (
    "https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/"
    "wskazniki-cen-towarow-i-uslug-konsumpcyjnych-pot-inflacja-/"
    "miesieczne-wskazniki-cen-towarow-i-uslug-konsumpcyjnych-od-1982-roku/"
)
GUS_YOY = "Analogiczny miesiąc poprzedniego roku = 100"


class ReferenceRate(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    effective_from: date
    rate_pct: Decimal = Field(ge=0, lt=100, max_digits=7, decimal_places=4)
    source_url: str

    @model_validator(mode="after")
    def valid_source_and_date(self) -> "ReferenceRate":
        if self.source_url not in (NBP_HISTORY_URL, NBP_CURRENT_URL):
            raise ValueError("Expected an official NBP reference-rate source")
        if self.effective_from > date.today():
            raise ValueError("NBP rate is not effective yet")
        return self


class InflationMonth(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    month: date
    rate_pct: Decimal = Field(gt=-100, lt=10000, max_digits=9, decimal_places=4)
    source_flag: str = ""
    source_url: str

    @model_validator(mode="after")
    def valid_source_and_month(self) -> "InflationMonth":
        if self.month.day != 1 or self.month >= date.today().replace(day=1):
            raise ValueError("Expected the first day of a completed observation month")
        url = urlparse(self.source_url)
        if (
            url.scheme != "https"
            or url.netloc != "stat.gov.pl"
            or not url.path.startswith("/download/")
            or not url.path.endswith(".csv")
        ):
            raise ValueError("Expected an official GUS CSV source")
        return self


class MacroData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reference_rates: list[ReferenceRate] = Field(min_length=1)
    inflation: list[InflationMonth] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_and_continuous(self) -> "MacroData":
        rate_dates = [row.effective_from for row in self.reference_rates]
        months = sorted(row.month.year * 12 + row.month.month for row in self.inflation)
        if len(set(rate_dates)) != len(rate_dates):
            raise ValueError("Duplicate NBP effective date")
        if months != list(range(months[0], months[-1] + 1)):
            raise ValueError("Duplicate or missing GUS observation month")
        return self


def parse_nbp(history: bytes, current: bytes) -> list[ReferenceRate]:
    roots = [ElementTree.fromstring(history), ElementTree.fromstring(current)]
    if [root.tag for root in roots] != [
        "stopy_procentowe_archiwum",
        "stopy_procentowe",
    ]:
        raise ValueError("Unexpected NBP XML structure")
    rates: dict[date, ReferenceRate] = {}
    for group in roots[0].findall("pozycje"):
        entry = group.find("pozycja[@id='ref']")
        if entry is None:
            raise ValueError("Missing reference rate in NBP historical entry")
        row = ReferenceRate(
            effective_from=date.fromisoformat(group.attrib["obowiazuje_od"]),
            rate_pct=Decimal(entry.attrib["oprocentowanie"].replace(",", ".")),
            source_url=NBP_HISTORY_URL,
        )
        if row.effective_from in rates:
            raise ValueError("Duplicate NBP historical date")
        rates[row.effective_from] = row
    if not rates:
        raise ValueError("Empty NBP history")
    entry = roots[1].find("tabela[@id='stoproc']/pozycja[@id='ref']")
    if entry is None:
        raise ValueError("Missing current NBP reference rate")
    row = ReferenceRate(
        effective_from=date.fromisoformat(entry.attrib["obowiazuje_od"]),
        rate_pct=Decimal(entry.attrib["oprocentowanie"].replace(",", ".")),
        source_url=NBP_CURRENT_URL,
    )
    old = rates.get(row.effective_from)
    if old is not None and old.rate_pct != row.rate_pct:
        raise ValueError("Conflicting current and historical NBP rates")
    if row.effective_from < max(rates):
        raise ValueError("Current NBP source is older than the history")
    rates[row.effective_from] = row
    return sorted(rates.values(), key=lambda item: item.effective_from)


def parse_gus(content: bytes, source_url: str) -> list[InflationMonth]:
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("cp1250")
    reader = csv.DictReader(io.StringIO(decoded), delimiter=";")
    required = {
        "Nazwa zmiennej",
        "Jednostka terytorialna",
        "Sposób prezentacji",
        "Rok",
        "Miesiąc",
        "Wartość",
        "Flaga",
    }
    if not required.issubset(reader.fieldnames or []):
        raise ValueError("Unexpected GUS CSV columns")
    rows = []
    for entry in reader:
        if (
            entry["Nazwa zmiennej"] != "Wskaźnik cen towarów i usług konsumpcyjnych"
            or entry["Jednostka terytorialna"] != "Polska"
            or entry["Sposób prezentacji"] != GUS_YOY
        ):
            continue
        value = entry["Wartość"].strip()
        if not value:
            continue  # GUS includes blank cells for months not published yet.
        rows.append(
            InflationMonth(
                month=date(int(entry["Rok"]), int(entry["Miesiąc"]), 1),
                rate_pct=Decimal(value.replace(",", ".")) - Decimal(100),
                source_flag=entry["Flaga"].strip(),
                source_url=source_url,
            )
        )
    if not rows:
        raise ValueError("No Polish year-over-year CPI in GUS source")
    return sorted(rows, key=lambda item: item.month)


class _CsvLinks(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.urls: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        href = dict(attrs).get("href")
        if tag != "a" or not href:
            return
        url = urljoin(GUS_PAGE_URL, href)
        parsed = urlparse(url)
        if (
            parsed.scheme == "https"
            and parsed.netloc == "stat.gov.pl"
            and parsed.path.startswith("/download/")
            and parsed.path.rsplit("/", 1)[-1].startswith(
                "miesiecznewskaznikicentowarowiuslugkonsumpcyjnychod1982roku"
            )
            and parsed.path.endswith(".csv")
        ):
            self.urls.add(url)


def gus_csv_url(html: str) -> str:
    links = _CsvLinks()
    links.feed(html)
    if len(links.urls) != 1:
        raise ValueError("Expected exactly one GUS monthly CPI CSV download")
    return next(iter(links.urls))


def download(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "SimpleFund/1.0"})
    with urlopen(request, timeout=30) as response:
        return response.read()


def fetch_macro_data() -> MacroData:
    rates = parse_nbp(download(NBP_HISTORY_URL), download(NBP_CURRENT_URL))
    url = gus_csv_url(download(GUS_PAGE_URL).decode("utf-8-sig"))
    return MacroData(reference_rates=rates, inflation=parse_gus(download(url), url))
