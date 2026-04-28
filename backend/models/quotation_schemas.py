from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from typing import List, Optional, Dict
from datetime import datetime

class TaskSchema(BaseModel):
    id: int
    description: str
    referenceNumber: str
    hours: float
    minutes: float
    overtimeHours: float
    softwareUnits: float
    type: str
    unitType: str
    isMainTask: bool
    parentId: Optional[int] = None

class BaseRatesSchema(BaseModel):
    timeChargeRate2D: float
    timeChargeRate3D: float
    timeChargeRateOthers: float
    otHoursMultiplier: float
    overtimeRate: float
    softwareRate: float
    overheadPercentage: float

class CompanyInfoSchema(BaseModel):
    name: str
    address: str
    city: str
    location: str
    phone: str

class ClientInfoSchema(BaseModel):
    company: str
    contact: str
    address: str
    phone: str

class QuotationDetailsSchema(BaseModel):
    quotationNo: str
    referenceNo: str
    date: str

class BillingDetailsSchema(BaseModel):
    invoiceNo: str
    jobOrderNo: str
    bankName: str
    accountName: str
    accountNumber: str
    bankAddress: str
    swiftCode: str
    branchCode: str

class SignaturePersonSchema(BaseModel):
    name: str
    title: str

class ReceivedBySchema(BaseModel):
    label: str
    title: Optional[str] = None

class SignaturesSchema(BaseModel):
    quotation: Dict[str, SignaturePersonSchema | ReceivedBySchema]
    billing: Dict[str, SignaturePersonSchema]

class FooterOverridesSchema(BaseModel):
    overhead: Optional[float] = None
    adjustment: Optional[float] = None

class TaskOverridesSchema(BaseModel):
    total: Optional[float] = None
    unitPage: Optional[float] = None

class ManualOverridesSchema(BaseModel):
    tasks: Dict[int, TaskOverridesSchema]
    footer: FooterOverridesSchema

class ChatMsgSchema(BaseModel):
    id: str
    sid: str
    name: str
    color: str
    message: str
    time: str
    isEdited: Optional[bool] = False
    isDeleted: Optional[bool] = False
    readBy: Optional[List[str]] = []

class QuotationDataSchema(BaseModel):
    companyInfo: CompanyInfoSchema
    clientInfo: ClientInfoSchema
    quotationDetails: QuotationDetailsSchema
    billingDetails: BillingDetailsSchema
    tasks: List[TaskSchema]
    baseRates: BaseRatesSchema
    signatures: SignaturesSchema
    manualOverrides: ManualOverridesSchema
    collapsedTaskIds: List[int]
    chatLog: List[ChatMsgSchema]
    savedAt: Optional[str] = None

class QuotationCreateSchema(BaseModel):
    data: QuotationDataSchema

class QuotationResponseSchema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    id: int
    quotationNo: str
    clientName: Optional[str] = None
    designerName: Optional[str] = None
    workstation: Optional[str] = None
    date: Optional[datetime] = None
    modifiedAt: Optional[datetime] = None
    is_active: bool
    hasPassword: bool = False
    password: Optional[str] = None
    display_name: Optional[str] = None

class QuotationListResponse(BaseModel):
    quotations: List[QuotationResponseSchema]
    total: int
