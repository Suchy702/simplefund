import hmac
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_admin, get_current_user

router = APIRouter(include_in_schema=False)
COOKIE_NAME = "simplefund_docs"
DOCS_PATH = "/api/v1/admin/docs"
SESSION_SECONDS = 600


def signing_key() -> str:
    return hmac.digest(
        settings.supabase_jwt_secret.encode(), b"simplefund-admin-docs", "sha256"
    ).hex()


def docs_admin(request: Request, db: Session = Depends(get_db)) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Otwórz dokumentację z panelu administratora.")
    try:
        user = jwt.decode(
            token,
            signing_key(),
            algorithms=["HS256"],
            audience="admin-docs",
            issuer="simplefund",
            options={"require_exp": True, "require_sub": True},
        )
        UUID(user["sub"])
    except (JWTError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(
            401, "Sesja dokumentacji wygasła. Otwórz ją ponownie z panelu."
        ) from exc
    return get_current_admin(user=user, db=db)


@router.post(f"{DOCS_PATH}/session")
async def create_docs_session(
    request: Request,
    access_token: str = Form(...),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    user = await get_current_user(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token)
    )
    get_current_admin(user=user, db=db)
    now = int(datetime.now(timezone.utc).timestamp())
    expires = min(now + SESSION_SECONDS, int(user["exp"]))
    token = jwt.encode(
        {
            "sub": user["sub"],
            "iat": now,
            "exp": expires,
            "aud": "admin-docs",
            "iss": "simplefund",
        },
        signing_key(),
        algorithm="HS256",
    )
    response = RedirectResponse(
        f"{request.scope.get('root_path', '')}{DOCS_PATH}", status_code=303
    )
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=expires - now,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        path="/",
    )
    return response


@router.get("/docs", dependencies=[Depends(docs_admin)])
@router.get(DOCS_PATH, dependencies=[Depends(docs_admin)])
def swagger(request: Request) -> HTMLResponse:
    return get_swagger_ui_html(
        openapi_url=f"{request.scope.get('root_path', '')}{DOCS_PATH}/openapi.json",
        title="SimpleFund · API",
        swagger_ui_parameters={"persistAuthorization": False, "validatorUrl": None},
    )


@router.get("/redoc", dependencies=[Depends(docs_admin)])
@router.get(f"{DOCS_PATH}/redoc", dependencies=[Depends(docs_admin)])
def redoc(request: Request) -> HTMLResponse:
    return get_redoc_html(
        openapi_url=f"{request.scope.get('root_path', '')}{DOCS_PATH}/openapi.json",
        title="SimpleFund · API",
    )


@router.get("/openapi.json", dependencies=[Depends(docs_admin)])
@router.get(f"{DOCS_PATH}/openapi.json", dependencies=[Depends(docs_admin)])
def openapi(request: Request) -> JSONResponse:
    return JSONResponse(request.app.openapi())
