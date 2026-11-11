import warnings

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.docs import DOCS_PATH
from app.api.docs import router as docs_router
from app.api.v1.admin import router as admin_router
from app.api.v1.router import router

# yfinance 1.7.0 still uses the deprecated pandas sort_index argument.
warnings.filterwarnings(
    "ignore",
    message=r"The inplace keyword in DataFrame\.sort_index is deprecated.*",
    category=DeprecationWarning,
    module=r"yfinance\.utils",
)

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(docs_router)


@app.middleware("http")
async def private_docs_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path in {"/docs", "/redoc", "/openapi.json"} or (
        request.url.path == DOCS_PATH or request.url.path.startswith(f"{DOCS_PATH}/")
    ):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
