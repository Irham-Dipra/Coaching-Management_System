from typing import List
from fastapi import APIRouter, HTTPException
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentCreate, PaymentUpdate

router = APIRouter()
payment_repo = PaymentRepository()

@router.get("/payments/recent")
def get_recent_payments():
    return payment_repo.get_recent_payments()

@router.post("/payments")
def create_payment(payment: PaymentCreate):
    try:
        # Legacy Single: Wrap in list for atomic bulk logic or keep distinct?
        # User wants Atomic. Let's redirect to bulk logic for safety if we want.
        # But schema has transaction_group_id optional.
        # Let's keep legacy working or use bulk under hood. 
        # Repository has create_payment removed? No, I replaced it?
        # Step 1725: I REPLACED create_payment with create_bulk_payment!
        # So I MUST update this route to use create_bulk_payment but wrapping single item.
        return payment_repo.create_bulk_payment([payment.dict()])[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/payments/{payment_id}")
def update_payment(payment_id: int, payment: PaymentUpdate): 
    # PaymentUpdate enforces types but allows optionals.
    try:
        return payment_repo.update_payment(payment_id, payment.dict(exclude_unset=True))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/payments/bulk")
def create_bulk_payment(payments: List[PaymentCreate]):
    try:
        return payment_repo.create_bulk_payment([p.dict() for p in payments])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/enrollments/{enrollment_id}/payment-status")
def get_payment_status(enrollment_id: int):
    try:
        return payment_repo.get_payment_status(enrollment_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/students/{student_id}/payments")
def get_student_payments(student_id: int):
    return payment_repo.get_student_payments(student_id)

@router.get("/finance/stats")
def get_finance_stats():
    return payment_repo.get_finance_stats()

@router.get("/finance/programs")
def get_program_finance_stats():
    return payment_repo.get_program_finance_stats()

@router.get("/finance/revenue-breakdown")
def get_revenue_breakdown(month: int = None, year: int = None, program_id: int = None):
    return payment_repo.get_revenue_breakdown(month, year, program_id)

@router.get("/finance/due-breakdown")
def get_due_breakdown():
    return payment_repo.get_due_breakdown_list()

@router.get("/programs/{program_id}/payment-status")
def get_program_payment_status(program_id: int, month: int, year: int):
    try:
        return payment_repo.get_program_payment_status(program_id, month, year)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
