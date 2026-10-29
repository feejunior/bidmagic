from typing import Annotated, Any

from fastapi import APIRouter, Path

from app.core.deps import LotId, SessionDep
from app.schemas.audit import AuditOut, ReceiptOut
from app.services import audit as audit_service

router = APIRouter(prefix="/api", tags=["audit"])


@router.get("/receipts/{public_code}", response_model=ReceiptOut)
async def get_receipt(
    public_code: Annotated[str, Path(max_length=43)], session: SessionDep
) -> dict[str, Any]:
    return await audit_service.get_receipt(session, public_code)


@router.get("/audit/lots/{lot_id}", response_model=AuditOut)
async def audit_lot(lot_id: LotId, session: SessionDep) -> dict[str, Any]:
    return await audit_service.audit_lot(session, lot_id)
