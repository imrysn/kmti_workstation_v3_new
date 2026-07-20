from typing import Optional
from pydantic import BaseModel, ConfigDict

class QuotationCreatePayload(BaseModel):
    # Lightweight workspace-first fields
    quot_no: Optional[str] = None
    display_name: Optional[str] = None
    password: Optional[str] = None
    workstation: Optional[str] = None
    client_name: Optional[str] = None
    designer_name: Optional[str] = None
    grand_total: Optional[float] = None
    customer_incharge: Optional[str] = None
    quotation_status: Optional[str] = None
    project_status: Optional[str] = None
    billing_status: Optional[str] = None
    bill_to: Optional[str] = None
    update_detail: Optional[str] = None
    date: Optional[str] = None
    
    # Full document save fields
    quotationDetails: Optional[dict] = None
    clientInfo: Optional[dict] = None
    signatures: Optional[dict] = None

    model_config = ConfigDict(extra="allow")
