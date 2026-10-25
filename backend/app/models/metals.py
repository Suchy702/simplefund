from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class Metal(str, Enum):
    gold = "gold"
    silver = "silver"
    platinum = "platinum"
    palladium = "palladium"


@dataclass(frozen=True)
class MetalDefinition:
    name: str
    ticker: str
    yahoo_symbol: str
    display_symbol: str


# Internal symbols keep physical metal holdings separate from futures positions.
METALS = {
    Metal.gold: MetalDefinition("Złoto", "METAL_GOLD", "GC=F", "Au"),
    Metal.silver: MetalDefinition("Srebro", "METAL_SILVER", "SI=F", "Ag"),
    Metal.platinum: MetalDefinition("Platyna", "METAL_PLATINUM", "PL=F", "Pt"),
    Metal.palladium: MetalDefinition("Pallad", "METAL_PALLADIUM", "PA=F", "Pd"),
}
METALS_BY_TICKER = {definition.ticker: definition for definition in METALS.values()}
GRAMS_PER_TROY_OUNCE = Decimal("31.1034768")
