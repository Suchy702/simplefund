import asyncio
import json
from threading import Lock
from time import monotonic
from urllib.error import URLError
from urllib.request import urlopen
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.profiles import Profile

security = HTTPBearer()
_jwks_lock = Lock()
_jwks_keys: list[dict] = []
_jwks_loaded_at = float("-inf")


def get_signing_key(kid: str, algorithm: str) -> dict:
    global _jwks_keys, _jwks_loaded_at
    with _jwks_lock:
        key = next((key for key in _jwks_keys if key.get("kid") == kid), None)
        age = monotonic() - _jwks_loaded_at
        if age >= 300 or (key is None and age >= 30):
            url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            try:
                with urlopen(url, timeout=5) as response:
                    keys = json.load(response).get("keys")
                if not isinstance(keys, list) or any(
                    not isinstance(item, dict) for item in keys
                ):
                    raise ValueError("Invalid signing keys")
            except (URLError, OSError, ValueError, AttributeError) as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Nie udało się zweryfikować sesji. Spróbuj ponownie.",
                ) from exc
            _jwks_keys = keys
            _jwks_loaded_at = monotonic()
            key = next((key for key in keys if key.get("kid") == kid), None)
        expected_key_type = {"ES256": "EC", "RS256": "RSA"}[algorithm]
        if (
            key is None
            or key.get("alg") != algorithm
            or key.get("kty") != expected_key_type
            or key.get("use", "sig") != "sig"
        ):
            raise JWTError("Unknown signing key")
        return key


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        if algorithm == "HS256":
            signing_key = settings.supabase_jwt_secret
        elif algorithm in ("ES256", "RS256"):
            kid = header.get("kid")
            if not isinstance(kid, str) or not kid:
                raise JWTError("Missing signing key ID")
            signing_key = await asyncio.to_thread(get_signing_key, kid, algorithm)
        else:
            raise JWTError("Unsupported signing algorithm")
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=[algorithm],
            audience="authenticated",
            issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
            options={"require_exp": True, "require_sub": True},
        )
        UUID(payload["sub"])
        if payload.get("role") != "authenticated":
            raise ValueError("Invalid role")
        return payload
    except (JWTError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


def get_current_admin(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        profile = db.get(Profile, UUID(user["sub"]))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Nie udało się sprawdzić uprawnień administratora.",
        ) from exc
    if profile is None or profile.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dostęp tylko dla administratorów.",
        )
    return user
