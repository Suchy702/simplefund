import enum


class AssetType(enum.Enum):
    stock = "stock"
    crypto = "crypto"
    metal = "metal"
    deposit = "deposit"
    bond = "bond"
    cash = "cash"


class TransactionType(enum.Enum):
    buy = "buy"
    sell = "sell"


class InterestType(enum.Enum):
    fixed = "fixed"
    variable = "variable"


class Currency(enum.Enum):
    PLN = "PLN"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    CHF = "CHF"
