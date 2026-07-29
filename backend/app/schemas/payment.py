from typing import List, Optional
from pydantic import BaseModel
from datetime import date

class PaymentBase(BaseModel):
    payment_id: Optional[int] = None
    enrollment_id: int
    paid_amount: float
    status: str = 'Paid' 
    payment_date: str
    month: Optional[float] = None
    year: Optional[float] = None
    transaction_group_id: Optional[str] = None
    payment_method: Optional[str] = "Cash"
    remarks: Optional[str] = None

class PaymentCreate(BaseModel):
    student_id: int
    program_id: int 
    paid_amount: float
    payment_date: str
    month: int
    year: int
    payment_method: str
    remarks: Optional[str] = None

class WaiveMonthRequest(BaseModel):
    month: int
    year: int
    program_id: int

class PaymentUpdate(BaseModel):
    enrollment_id: Optional[int] = None
    paid_amount: Optional[float] = None
    payment_date: Optional[str] = None
    month: Optional[int] = None
    year: Optional[int] = None
    payment_method: Optional[str] = None
    remarks: Optional[str] = None
    status: Optional[str] = None


class PaymentResponse(PaymentBase):
    student_name: str
    program_name: str
    roll_no: Optional[int] = None
