from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from app.scrapers.polish_bonds import scrape_issues
from app.scrapers.polish_bonds.fetcher import CATALOG_URLS
from app.scrapers.polish_bonds.parser import (
    parse_catalog,
    parse_issue,
    parse_letter_rates,
    sale_month,
)

FIXTURES = Path(__file__).parent / "fixtures" / "polish_bonds"


def offer(code):
    return (FIXTURES / f"{code}.html").read_text()


def catalog(*codes):
    return "".join(
        f'<option value="/listy-emisyjne/?id={code.lower()},{code[:3].lower()}">'
        f"{code}</option>"
        for code in codes
    )


@pytest.mark.parametrize(
    "code,fixed,first,margin",
    [
        ("TOS1029", "4.40", None, None),
        ("COI1030", None, "4.75", "1.50"),
        ("EDO1036", None, "5.35", "2.00"),
        ("EDO0134", None, "6.90", "1.50"),
    ],
)
def test_official_offer_details(code, fixed, first, margin):
    issue = parse_issue(offer(code), code, "https://example.test/offer")
    assert issue.fixed_rate_pct == (Decimal(fixed) if fixed else None)
    assert issue.first_period_rate_pct == (Decimal(first) if first else None)
    assert issue.inflation_margin_pp == (Decimal(margin) if margin else None)
    assert issue.sale_start == (
        date(2024, 1, 1) if code == "EDO0134" else date(2026, 10, 1)
    )
    assert issue.issue_letter_url.startswith(
        "https://www.obligacjeskarbowe.pl/media_files/"
    )
    assert issue.model_dump(mode="json")["fixed_rate_pct"] == fixed


def test_catalog_ignores_unsupported_families_and_deduplicates():
    assert parse_catalog(catalog("EDO1036", "EDO1036", "DOS1027")) == {"EDO1036"}


@pytest.mark.parametrize(
    "code,kind,fixed,first,inflation,nbp",
    [
        ("ROD1038", "inflation_linked", None, "5.60", "2.50", None),
        ("ROS1032", "inflation_linked", None, "5.00", "2.00", None),
        ("DOR1028", "reference_rate_linked", None, "4.15", None, "0.15"),
        ("ROR1027", "reference_rate_linked", None, "4.00", None, "0.00"),
        ("OTS0127", "fixed", "2.00", None, None, None),
    ],
)
def test_added_family_official_terms(code, kind, fixed, first, inflation, nbp):
    issue = parse_issue(offer(code), code, "local")
    assert issue.interest_type == kind
    assert (
        issue.fixed_rate_pct,
        issue.first_period_rate_pct,
        issue.inflation_margin_pp,
        issue.nbp_margin_pp,
    ) == tuple(
        Decimal(value) if value is not None else None
        for value in (fixed, first, inflation, nbp)
    )
    assert issue.sale_start == date(2026, 10, 1)


def test_ots_sale_month_crosses_year_boundary():
    assert sale_month("OTS0127") == date(2026, 10, 1)
    assert sale_month("OTS0327") == date(2026, 12, 1)
    assert sale_month("OTS0427") == date(2027, 1, 1)


@pytest.mark.parametrize(
    "code,first,margin",
    [
        ("ROR0623", "5.25", "0.00"),
        ("DOR0624", "5.50", "0.25"),
        ("DOR0724", "6.25", "0.25"),
    ],
)
def test_pdf_nbp_margin_is_distinct_from_inflation(code, first, margin):
    reference = "referenc yjnej" if code == "DOR0724" else "referencyjnej"
    text = (
        f"{code} W pierwszym okresie odsetkowym stopa procentowa wynosi {first}%. "
        f"Stopa jest obliczana jako suma stopy {reference} Narodowego Banku "
        f"Polskiego (NBP) i marży w wysokości {margin}%."
    )
    assert parse_letter_rates(text, code) == (Decimal(first), Decimal(margin))


def test_latest_includes_all_eight_families():
    codes = [
        "ROD1038",
        "ROS1032",
        "COI1030",
        "EDO1036",
        "TOS1029",
        "DOR1028",
        "ROR1027",
        "OTS0127",
    ]

    def fetch(url):
        if url in CATALOG_URLS:
            return catalog(*reversed(codes))
        return offer(url.rstrip("/").split("/")[-1].upper())

    result = scrape_issues(latest=True, fetch=fetch)
    assert result.complete
    assert {issue.series_code for issue in result.issues} == set(codes)


@pytest.mark.parametrize(
    "code,first,margin",
    [
        ("COI0807", "5.3", "3.0"),
        ("EDO1014", "7.1", "3.5"),
        ("COI0114", "5.75", "2.50"),
        ("EDO0120", "6.75", "2.75"),
    ],
)
def test_legacy_pdf_text_with_non_unicode_polish_font(code, first, margin):
    text = (FIXTURES / f"{code}.txt").read_text()
    issue = parse_issue(offer(code), code, "local", letter_text=text)
    assert issue.first_period_rate_pct == Decimal(first)
    assert issue.inflation_margin_pp == Decimal(margin)


def test_pdf_with_another_series_is_rejected():
    with pytest.raises(ValueError, match="does not match"):
        parse_letter_rates((FIXTURES / "EDO1014.txt").read_text(), "EDO1114")


def test_pdf_without_explicit_terms_is_rejected():
    with pytest.raises(ValueError, match="unambiguously"):
        parse_letter_rates("EDO1014 no readable rates", "EDO1014")


def test_pdf_windows_font_mapping():
    text = (
        "EDO0117 W pierwszym okresie odsetkowym stopa procentowa wynosi 5,50%. "
        "w nastêpnych rocznych okresach odsetkowych o sta³¹ mar¿ê w wysokoœci 2,50%."
    )
    assert parse_letter_rates(text, "EDO0117") == (Decimal("5.50"), Decimal("2.50"))


def test_pdf_fixed_rate_and_fragmented_series_code():
    text = (
        "TOS122 5 Oprocentowanie obligacji wynosi 6,85% w stosunku rocznym "
        "i jest stałe przez okres trzech lat."
    )
    assert parse_letter_rates(text, "TOS1225") == (Decimal("6.85"), None)


@pytest.mark.parametrize(
    "margin_clause",
    [
        "w następnych rocznych okresach odsetkowych o stałą mar Ŝę w wysokości 1,50%",
        "w nas tepnych rocznych okresach odsetkowych "
        "o st ala marze w w ysokos ci 1,50%",
    ],
)
def test_pdf_fragmented_margin_words(margin_clause):
    text = (
        "EDO0824 W pierwszym okresie odsetkowym stopa procentowa wynosi 4,00%. "
        + margin_clause
    )
    assert parse_letter_rates(text, "EDO0824") == (Decimal("4.00"), Decimal("1.50"))


def test_invalid_html_sale_dates_require_explicit_pdf_dates():
    html = offer("EDO0134").replace("31.01.2024", "31.01.2023")
    text = (
        "EDO0134 Obligacje są oferowane do sprzedaży w dniach od 1 do 31 stycznia "
        "2024 r. W pierwszym okresie odsetkowym stopa procentowa wynosi 6,90%. "
        "W następnych rocznych okresach odsetkowych o stałą marżę w wysokości 1,50%."
    )
    issue = parse_issue(html, "EDO0134", "local", letter_text=text)
    assert issue.sale_start == date(2024, 1, 1)
    assert issue.sale_end == date(2024, 1, 31)
    with pytest.raises(ValueError, match="no explicit dates"):
        parse_issue(html, "EDO0134", "local", letter_text=text.replace("w dniach", ""))


@pytest.mark.parametrize(
    "html,code",
    [
        (offer("EDO1036"), "EDO0134"),
        (offer("EDO1036").replace("marża", "unknown"), "EDO1036"),
        (offer("EDO1036").replace("5,35%", "unknown"), "EDO1036"),
        (offer("EDO1036").replace("5,35%", "-5,35%"), "EDO1036"),
        (offer("EDO1036").replace("01.10.2026", "01.09.2026"), "EDO1036"),
        ("<html>Page unavailable</html>", "EDO1036"),
    ],
)
def test_unrecognized_or_mismatched_offer_is_rejected(html, code):
    with pytest.raises(ValueError):
        parse_issue(html, code, "https://example.test/offer")


def fetcher(calls, *, broken=None):
    def fetch(url):
        calls.append(url)
        if url == broken:
            raise OSError("Source unavailable")
        if url == CATALOG_URLS[0]:
            return catalog("EDO0134", "COI1030", "EDO1036", "TOS1029")
        if url == CATALOG_URLS[1]:
            return catalog("EDO0134")
        code = url.rstrip("/").split("/")[-1].upper()
        if code == broken:
            raise OSError("Source unavailable")
        return offer(code)

    return fetch


@pytest.mark.parametrize(
    "kwargs,expected",
    [
        ({}, ["TOS1029", "EDO1036", "COI1030", "EDO0134"]),
        ({"latest": True}, ["TOS1029", "EDO1036", "COI1030"]),
        ({"since": date(2026, 10, 24)}, ["TOS1029", "EDO1036", "COI1030"]),
        ({"through_series": "edo0134", "families": {"EDO"}}, ["EDO1036", "EDO0134"]),
        ({"since": date(2026, 11, 1)}, []),
    ],
)
def test_range_selection_and_newest_first(kwargs, expected):
    calls = []
    result = scrape_issues(fetch=fetcher(calls), **kwargs)
    assert result.complete
    assert [issue.series_code for issue in result.issues] == expected
    assert len(calls) == 2 + len(expected)


def test_offer_failure_keeps_other_issues_and_marks_incomplete():
    result = scrape_issues(latest=True, fetch=fetcher([], broken="EDO1036"))
    assert not result.complete
    assert [issue.series_code for issue in result.issues] == ["TOS1029", "COI1030"]
    assert result.errors[0].series_code == "EDO1036"


def test_catalog_failure_marks_result_incomplete():
    result = scrape_issues(fetch=fetcher([], broken=CATALOG_URLS[1]))
    assert not result.complete
    assert result.errors[0].source_url == CATALOG_URLS[1]


@pytest.mark.parametrize(
    "kwargs",
    [
        {"families": set()},
        {"families": {"DOS"}},
        {"since": date(2024, 1, 1), "latest": True},
        {"through_series": "EDO0134", "families": {"TOS"}},
        {"through_series": "invalid"},
        {"through_series": "EDO0130"},
    ],
)
def test_invalid_request_raises(kwargs):
    with pytest.raises(ValueError):
        scrape_issues(fetch=fetcher([]), **kwargs)
