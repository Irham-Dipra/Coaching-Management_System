from typing import List
from fastapi import APIRouter, HTTPException, Query
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentCreate, PaymentUpdate, WaiveMonthRequest

router = APIRouter()
payment_repo = PaymentRepository()

@router.get("/payments/recent")
def get_recent_payments(
    page: int = 1, 
    page_size: int = 50, 
    search: str = None, 
    month: int = None, 
    year: int = None, 
    program_id: int = None, 
    roll_no: str = None,
    class_grade: int = Query(None, alias="class"),
    batch_id: int = None,
    start_date: str = None,
    end_date: str = None
):
    filters = {}
    if month: filters['month'] = month
    if year: filters['year'] = year
    if program_id: filters['program_id'] = program_id
    if roll_no: filters['roll_no'] = roll_no
    if class_grade: filters['class'] = class_grade
    if batch_id: filters['batch_id'] = batch_id
    if start_date: filters['start_date'] = start_date
    if end_date: filters['end_date'] = end_date
    
    return payment_repo.get_payments_paginated(page, page_size, search, filters)

@router.post("/payments")
def create_payment(payment: PaymentCreate):
    try:
        # Legacy Single: Wrap in list for atomic bulk logic.
        # create_bulk_payment returns a dict: {'success': N, 'failed': [], 'data': [...]}
        result = payment_repo.create_bulk_payment([payment.dict()])
        
        if result['failed']:
            # For single payment, if it failed, we raise an error immediately.
            failure = result['failed'][0]
            raise HTTPException(status_code=400, detail=f"Payment Failed: {failure['reason']}")
            
        if not result['data']:
            raise HTTPException(status_code=500, detail="Payment created but no data returned")
            
        return result['data'][0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/payments/{payment_id}")
def update_payment(payment_id: int, payment: PaymentUpdate): 
    # PaymentUpdate enforces types but allows optionals.
    try:
        return payment_repo.update_payment(payment_id, payment.dict(exclude_unset=True))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int):
    try:
        return payment_repo.delete_payment(payment_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/payments/bulk")
def create_bulk_payment(payments: List[PaymentCreate]):
    try:
        return payment_repo.create_bulk_payment([p.dict() for p in payments])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/finance/waive-month")
def waive_month_for_program(request: WaiveMonthRequest):
    try:
        return payment_repo.waive_month_for_program(request.month, request.year, request.program_id)
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

@router.get("/finance/stats/quick")
def get_finance_stats_quick():
    """Fast stats: student/program counts + revenue. Returns in ~300ms."""
    return payment_repo.get_finance_stats_quick()

@router.get("/finance/stats/dues")
def get_finance_stats_dues():
    """Heavy due stats: total_due + due_this_month. Cached after first call."""
    return payment_repo.get_finance_stats_dues()


@router.get("/finance/programs")
def get_program_finance_stats():
    return payment_repo.get_program_finance_stats()

@router.get("/finance/revenue-breakdown")
def get_revenue_breakdown(month: int = None, year: int = None, program_id: int = None):
    return payment_repo.get_revenue_breakdown(month, year, program_id)

@router.get("/finance/due-breakdown")
def get_due_breakdown(program_id: int = None):
    return payment_repo.get_due_breakdown_list(program_id)

@router.get("/finance/due-breakdown/monthly")
def get_due_breakdown_monthly(month: int = None, year: int = None, program_id: int = None):
    return payment_repo.get_due_breakdown_monthly(month, year, program_id)

@router.get("/programs/{program_id}/payment-status")
def get_program_payment_status(program_id: int, month: int, year: int):
    try:
        return payment_repo.get_program_payment_status(program_id, month, year)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
