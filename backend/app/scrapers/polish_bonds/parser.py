import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal
from html.parser import HTMLParser
from typing import cast
from urllib.parse import urljoin, urlparse

from app.scrapers.polish_bonds.schemas import Family, Issue

BASE_URL = "https://www.obligacjeskarbowe.pl"
# These supported families have a fixed contractual duration.
TERMS = {
    "ROD": 144,
    "ROS": 72,
    "COI": 48,
    "EDO": 120,
    "TOS": 36,
    "DOR": 24,
    "ROR": 12,
    "OTS": 3,
}
FIXED_FAMILIES = {"TOS", "OTS"}
REFERENCE_FAMILIES = {"ROR", "DOR"}
SERIES = re.compile(r"(ROD|ROS|COI|EDO|TOS|DOR|ROR|OTS)(0[1-9]|1[0-2])(\d{2})\Z")


def sale_month(series_code: str) -> date:
    """Infer the sale month for supported families; verify against the offer later."""
    match = SERIES.fullmatch(series_code)
    if match is None:
        raise ValueError(f"Unsupported series: {series_code}")
    family, month, year = match.groups()
    sale_year, sale_month_index = divmod(
        (2000 + int(year)) * 12 + int(month) - 1 - TERMS[family], 12
    )
    return date(sale_year, sale_month_index + 1, 1)


class _Document(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.options: list[str] = []
        self.details: list[str] = []
        self.pdfs: list[str] = []
        self._depth = 0
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "option" and attributes.get("value"):
            self.options.append(attributes["value"] or "")
        if tag == "ul":
            if (
                self._depth
                or "product-details__list" in (attributes.get("class") or "").split()
            ):
                self._depth += 1
        if self._depth and tag == "li":
            self._parts = []
        if self._depth and tag == "a":
            href = attributes.get("href") or ""
            if urlparse(href).path.endswith(".pdf"):
                self.pdfs.append(urljoin(BASE_URL, href))

    def handle_endtag(self, tag: str) -> None:
        if self._depth and tag == "li":
            self.details.append(" ".join(" ".join(self._parts).split()))
        if self._depth and tag == "ul":
            self._depth -= 1

    def handle_data(self, data: str) -> None:
        if self._depth:
            self._parts.append(data)


def parse_catalog(html: str) -> set[str]:
    document = _Document()
    document.feed(html)
    codes = set()
    for option in document.options:
        match = re.search(r"[?&]id=([a-z]+\d{4})(?:,|&|$)", option, re.I)
        if match and SERIES.fullmatch(code := match[1].upper()):
            codes.add(code)
    if not codes:
        raise ValueError("Catalog contains no supported series")
    return codes


def issue_letter_url(html: str) -> str:
    document = _Document()
    document.feed(html)
    if len(set(document.pdfs)) != 1:
        raise ValueError("Expected one issue letter PDF")
    return document.pdfs[0]


def _normalize_letter_text(text: str) -> str:
    """Normalize legacy Polish font mappings and PDF word fragmentation."""
    text = re.sub(r"(?<=\w)-\s+(?=\w)", "", text)
    text = re.sub(r"(?<=[^\W\d_])\s+(?=[ĊĪĞáüĔĨŜąćęłńóśźż])", "", text)
    text = text.translate(
        str.maketrans(
            {
                "˝": "z",
                "´": "e",
                "Ê": "s",
                "∏": "l",
                "à": "a",
                "ƒ": "n",
                "ç": "c",
                "∂": "s",
                "Ł": "L",
                "ł": "l",
                "Ċ": "e",
                "Ī": "z",
                "Ğ": "s",
                "á": "l",
                "ü": "c",
                "Ĕ": "n",
                "Ĩ": "z",
                "¹": "a",
                "ê": "e",
                "œ": "s",
                "³": "l",
                "¿": "z",
                "æ": "c",
                "ñ": "n",
                "Ÿ": "z",
                "Ŝ": "z",
            }
        )
    )
    text = "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )
    text = " ".join(text.lower().split())
    return re.sub(r"(?<=\d)([,.])\s+(?=\d)", r"\1", text)


def parse_letter_rates(text: str, series_code: str) -> tuple[Decimal, Decimal | None]:
    """Read explicit rates, never infer a percentage from another series."""
    identity = re.search(
        r"\b(?:TOS|COI|EDO|DOS|TOZ|OTS|ROR|DOR|ROS|ROD)\s*"
        r"\d\s*\d\s*\d\s*\d\b",
        text,
    )
    if identity is None or re.sub(r"\s+", "", identity[0]) != series_code:
        raise ValueError("PDF does not match the requested series")
    text = _normalize_letter_text(text)
    if series_code[:3] in FIXED_FAMILIES:
        rates = re.findall(
            r"oprocentowanie obligacji wynosi\s+(\d+(?:[,.]\d+)?)\s*%"
            r"[^.]{0,100}?jest stale",
            text,
        )
        if not rates:
            rates = re.findall(
                r"oprocentowanie obligacji jest stale i wynosi\s*"
                r"(\d+(?:[,.]\d+)?)\s*%",
                text,
            )
        if len(set(rates)) != 1:
            raise ValueError("Cannot unambiguously read fixed rate from PDF")
        return Decimal(rates[0].replace(",", ".")), None
    first = re.findall(
        r"w pierwszym (?:(?:rocznym|miesiecznym) )?okresie odsetkowym stopa procentowa "
        r"wynosi\s+(\d+(?:[,.]\d+)?)\s*%",
        text,
    )
    if series_code[:3] in REFERENCE_FAMILIES:
        margins = re.findall(
            r"stopy referencyjnej.{0,400}?i marzy w wysokosci\s*"
            r"(\d+(?:[,.]\d+)?)\s*%",
            text,
        )
        if not margins:
            margins = re.findall(
                r"stopyreferencyjnej.{0,400}?imarzywwysokosci"
                r"(\d+(?:[,.]\d+)?)%",
                re.sub(r"\s+", "", text),
            )
        if len(set(first)) != 1 or len(set(margins)) != 1:
            raise ValueError("Cannot unambiguously read initial rate and NBP margin")
        return (
            Decimal(first[0].replace(",", ".")),
            Decimal(margins[0].replace(",", ".")),
        )
    margins = re.findall(
        r"(?:nastepnych|kolejnych) (?:rocznych )?okresach odsetkowych.{0,100}?"
        r"marz\w* w wysokosci\s+(\d+(?:[,.]\d+)?)\s*%",
        text,
    )
    if not margins:
        compact = re.sub(r"\s+", "", text)
        margins = re.findall(
            r"(?:nastepnych|kolejnych)(?:rocznych)?okresachodsetkowych.{0,40}?"
            r"marz[ae]wwysokosci(\d+(?:[,.]\d+)?)%",
            compact,
        )
    if not margins:
        margins = re.findall(r"stala marze w wysokosci\s+(\d+(?:[,.]\d+)?)\s*%", text)
    if not margins:
        margins = re.findall(r"r\s*2\s*=\s*i\s*2\s*\+\s*(\d+(?:[,.]\d+)?)\s*%", text)
    if len(set(first)) != 1 or len(set(margins)) != 1:
        raise ValueError("Cannot unambiguously read initial rate and margin from PDF")
    return Decimal(first[0].replace(",", ".")), Decimal(margins[0].replace(",", "."))


def parse_issue(
    html: str, series_code: str, source_url: str, *, letter_text: str | None = None
) -> Issue:
    document = _Document()
    document.feed(html)
    fields = {}
    for detail in document.details:
        label, separator, value = detail.partition(":")
        if separator:
            if label in fields:
                raise ValueError(f"Duplicate offer field: {label}")
            fields[label] = value.strip()

    def required(label: str) -> str:
        value = fields.get(label)
        if not value:
            raise ValueError(f"Missing offer field: {label}")
        return value

    if required("Seria").split()[0] != series_code:
        raise ValueError(f"Offer does not match requested series {series_code}")
    dates = re.findall(r"\b\d{2}\.\d{2}\.\d{4}\b", required("Sprzedaż"))
    if len(dates) != 2:
        raise ValueError("Expected two sale dates")
    start, end = [datetime.strptime(value, "%d.%m.%Y").date() for value in dates]
    if end < start and letter_text is not None:
        match = re.search(
            r"do sprzedazy w dniach od (\d{1,2}) do (\d{1,2}) (\w+) (\d{4}) r",
            _normalize_letter_text(letter_text),
        )
        months = (
            "stycznia",
            "lutego",
            "marca",
            "kwietnia",
            "maja",
            "czerwca",
            "lipca",
            "sierpnia",
            "wrzesnia",
            "pazdziernika",
            "listopada",
            "grudnia",
        )
        if match is None or match[3] not in months:
            raise ValueError("Invalid HTML sale dates; no explicit dates found in PDF")
        month = months.index(match[3]) + 1
        start = date(int(match[4]), month, int(match[1]))
        end = date(int(match[4]), month, int(match[2]))
    if start.replace(day=1) != sale_month(series_code):
        raise ValueError("Sale month does not match the series code")
    description = required("Oprocentowanie")
    if letter_text is not None:
        first, margin = parse_letter_rates(letter_text, series_code)
        description = (
            f"{first}%, stałe"
            if margin is None
            else (
                f"{first}% w pierwszym rocznym okresie odsetkowym; "
                + (
                    f"stopa referencyjna NBP+{margin}%"
                    if series_code[:3] in REFERENCE_FAMILIES
                    else f"marża {margin}% + inflacja"
                )
            )
        )
    rates = re.findall(r"(\d+(?:[,.]\d+)?)\s*%", description)
    initial_rate = re.match(
        r"(?:w pierwszym (?:rocznym|miesięcznym) okresie odsetkowym:\s*)?"
        r"(\d+(?:[,.]\d+)?)\s*%",
        description,
    )
    if initial_rate is None:
        raise ValueError("Expected the initial rate at the start of the description")
    family = series_code[:3]
    rate = margin = None
    if family in FIXED_FAMILIES:
        if (
            len(rates) != 1
            or "inflac" in description.lower()
            or "stałe" not in description.lower()
        ):
            raise ValueError("Unrecognized fixed interest description")
    elif family in REFERENCE_FAMILIES:
        match = re.search(
            r"stopa referencyjna NBP\s*\+\s*(\d+(?:[,.]\d+)?)\s*%",
            description,
            re.I,
        )
        if len(rates) != 2 or match is None:
            raise ValueError("Unrecognized NBP-linked interest description")
        margin = Decimal(match[1].replace(",", "."))
    else:
        match = re.search(r"marża\s+(\d+(?:[,.]\d+)?)\s*%", description, re.I)
        if (
            len(rates) != 2
            or match is None
            or "inflac" not in description.lower()
            or not (
                "pierwszym" in description.lower()
                or "w kolejnych rocznych okresach odsetkowych" in description.lower()
            )
        ):
            raise ValueError("Unrecognized inflation-linked interest description")
        margin = Decimal(match[1].replace(",", "."))
    rate = Decimal(initial_rate[1].replace(",", "."))
    if len(set(document.pdfs)) != 1:
        raise ValueError("Expected one issue letter PDF")
    return Issue(
        series_code=series_code,
        family=cast(Family, family),
        sale_start=start,
        sale_end=end,
        term_months=TERMS[family],
        interest_type=(
            "fixed"
            if family in FIXED_FAMILIES
            else "reference_rate_linked"
            if family in REFERENCE_FAMILIES
            else "inflation_linked"
        ),
        fixed_rate_pct=rate if family in FIXED_FAMILIES else None,
        first_period_rate_pct=rate if family not in FIXED_FAMILIES else None,
        inflation_margin_pp=margin if family not in REFERENCE_FAMILIES else None,
        nbp_margin_pp=margin if family in REFERENCE_FAMILIES else None,
        capitalization=required("Kapitalizacja odsetek"),
        interest_payment=required("Wypłata odsetek"),
        source_url=source_url,
        issue_letter_url=document.pdfs[0],
    )
