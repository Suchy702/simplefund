from datetime import datetime, timedelta, timezone

import pytest
from app.dependencies import get_current_user
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

SECRET = "test-secret"
ALGORITHM = "HS256"


def make_token(payload: dict, secret: str = SECRET) -> str:
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def make_credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.fixture(autouse=True)
def patch_secret(monkeypatch):
    monkeypatch.setattr("app.dependencies.settings.supabase_jwt_secret", SECRET)


@pytest.mark.asyncio
async def test_valid_token_returns_payload():
    payload = {
        "sub": "user-123",
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = make_token(payload)
    result = await get_current_user(make_credentials(token))
    assert result["sub"] == "user-123"


@pytest.mark.asyncio
async def test_invalid_token_raises_401():
    credentials = make_credentials("not.a.valid.token")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_wrong_secret_raises_401():
    payload = {
        "sub": "user-123",
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = make_token(payload, secret="wrong-secret")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(make_credentials(token))
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_raises_401():
    payload = {
        "sub": "user-123",
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    token = make_token(payload)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(make_credentials(token))
    assert exc_info.value.status_code == 401
