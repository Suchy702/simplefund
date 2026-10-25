from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.xtb import XtbCommit, XtbPreview, XtbResolution, XtbResult
from app.services.stock_prices import invalidate_user_prices, refresh_user_prices
from app.services.xtb import commit_import, resolve_import, stage_import
from app.services.xtb_parser import MAX_FILE_BYTES

router = APIRouter(prefix="/imports/xtb", tags=["XTB"])


@router.post("/preview", response_model=XtbPreview)
def preview(
    files: list[UploadFile],
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(files) != 1:
        raise HTTPException(422, "Dodaj jeden plik XLSX naraz.")
    uploads = []
    try:
        for upload in files:
            content = upload.file.read(MAX_FILE_BYTES + 1)
            if len(content) > MAX_FILE_BYTES:
                raise HTTPException(422, "Maksymalny rozmiar pliku to 10 MB.")
            uploads.append((upload.filename or "raport.xlsx", content))
        return stage_import(db, user, uploads)
    finally:
        for upload in files:
            upload.file.close()


@router.post("/preview/{import_id}", response_model=XtbPreview)
def resolve(
    import_id: UUID,
    data: XtbResolution,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return resolve_import(db, user, import_id, data)


@router.post("/commit", response_model=XtbResult)
def commit(
    data: XtbCommit,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = commit_import(db, user, data)
    user_id = UUID(user["sub"])
    invalidate_user_prices(user_id)
    background_tasks.add_task(refresh_user_prices, user_id)
    return result
