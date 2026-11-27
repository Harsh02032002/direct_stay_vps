export type RoomStatus = 'Available' | 'Confirmed' | 'Occupied' | 'Dirty' | 'Out of Service';
export type CleaningStatus = 'Clean' | 'Dirty' | 'In Progress' | 'Inspection' | 'Inspected';
export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Room Charge' | 'Split Payment' | 'OTA Prepaid';
export type BookingSource = 'WALK-IN' | 'Website' | 'MakeMyTrip' | 'Booking.com' | 'Goibibo' | 'Agoda' | 'OYO' | 'Corporate';
export type BookingStatus = 'Confirmed' | 'Checked In' | 'Checked Out' | 'Pending' | 'Cancelled' | 'No-Show';
export type PaymentStatus = 'Paid' | 'Fully Paid' | 'Advance Paid' | 'Partially Paid' | 'Unpaid' | 'Refunded';
export type MealPlanType = 'Only Rooms' | 'Meals Included' | 'EP(SG)' | 'EP(TW)' | 'CP (With Breakfast)' | 'MAP (Breakfast + Dinner)';

export interface PlanPriceConfig {
  planName: MealPlanType;
  price: number;
  enabled: boolean;
}

export interface AssetGroup {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  taxRate: number;
  pricingMode: 'Match Pricing' | 'Diff Pricing';
  planPrices: PlanPriceConfig[];
  assetCount: number;
}

export interface RoomAsset {
  id: string;
  number: string;
  name: string;
  groupId: string;
  category: string;
  rate: number;
  mealsRate: number;
  status: RoomStatus;
  cleaningStatus: CleaningStatus;
  floor: string;
  bedType: string;
  maxOccupancy: number;
  baseOccupancy: number;
  extraPersonCharge: number;
  allowExtraBed?: boolean;
  isLive: boolean;
  amenities: string[];
  images?: string[];
  currentBookingId?: string;
  currentGuestName?: string;
  currentNights?: number;
  blockedReason?: string;
  assignedStaff?: string;
  verifiedBy?: string;
  verificationTime?: string;
  housekeepingPriority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  housekeepingNotes?: string;
  cleaningCompletedAt?: string;
}

export interface RoomBlockRecord {
  id: string;
  category: string;
  roomId: string;
  roomNumber: string;
  roomName: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface PriceHistoryRecord {
  id: string;
  groupId: string;
  groupName: string;
  planName: MealPlanType;
  price: number;
  addedOn: string;
  startDate: string;
  endDate: string;
}

export interface GuestPerson {
  id: string;
  name: string;
  phone: string;
  email: string;
  gender: 'Male' | 'Female' | 'Other';
  age: number;
  dob: string;
  isAdult: boolean;
  documentType: 'Aadhaar Card' | 'Pan Card' | 'Driving License' | 'Voter Id Card' | 'Passport' | 'Visa' | 'Other';
  documentNumber: string;
  documentImageUrl?: string;
}

export interface PaymentRecordItem {
  id: string;
  bookingId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId: string;
  date: string;
  time: string;
  recordedBy: string;
  notes?: string;
}

export interface OtherServiceItem {
  id: string;
  bookingId: string;
  orderNumber: string;
  roomNumber: string;
  roomName: string;
  serviceType:
    | 'ROOM SERVICE'
    | 'LAUNDRY'
    | 'WATER BOTTLE'
    | 'WATER / BEVERAGE'
    | 'EXTRA BED'
    | 'DAMAGE / FINE'
    | 'SPA / OTHER'
    | string;
  description: string;
  itemsSummary: string;
  quantity: number;
  amount: number;
  taxAmount: number;
  dateTime: string;
  isPaid: boolean;
  sourceKey?: string;
}

export interface BookedCategoryRequirement {
  id: string;
  categoryName: string;
  qty: number;
  planName: MealPlanType;
  unitPrice: number;
  assignedRooms: string[];
}

export interface BookingRecord {
  id: string;
  bookingNo: string;
  billId: string;
  bookingType: 'Personal' | 'Corporate';
  companyName?: string;
  companyGst?: string;
  gstInvoice: boolean;
  customerName: string;
  mobile: string;
  email: string;
  address: string;
  numGuests: number;
  adults: number;
  children: number;
  checkInDate: string;
  checkOutDate: string;
  isOpenStay?: boolean;
  expectedArrivalTime?: string;
  checkInTime?: string;
  checkOutTime?: string;
  nights: number;
  status: BookingStatus;
  paymentStatus?: PaymentStatus;
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  source: BookingSource;
  sourceBookingId?: string;
  bookedOn: string;
  requirements: BookedCategoryRequirement[];
  roomNumbers: string[];
  roomCategorySummary: string;
  roomSubtotal: number;
  otherServicesTotal: number;
  discountType: 'flat' | 'percent';
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalPayable: number;
  amountPaid: number;
  dueAmount: number;
  refundAmount?: number;
  cancellationReason?: string;
  guests: GuestPerson[];
  payments: PaymentRecordItem[];
  otherServices: OtherServiceItem[];
  remarks?: string;
  cFormPassportNo?: string;
  cFormVisaNo?: string;
  cFormNationality?: string;
  receivedAt?: string;
  otaCommissionPercent?: number;
  otaCommissionAmount?: number;
  changeHistory?: BookingChangeHistoryItem[];
  grcNumber?: string;
  city?: string;
  state?: string;
  nationality?: string;
  voucherNumber?: string;
  hasExtraBed?: boolean;
  extraBedCount?: number;
  extraBedRate?: number;
  extraBedCharges?: number;
  extraPersonCharges?: number;
  earlyCheckInCharge?: number;
}

export type InvoiceScope = 'Only Booking' | 'Only Other Services' | 'Booking + Other Services';

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  bookingNo: string;
  invoiceScope: InvoiceScope;
  customerName: string;
  mobile: string;
  companyName?: string;
  gstNumber?: string;
  roomNumbers: string[];
  checkInDateTime: string;
  checkOutDateTime: string;
  bookedOnDateTime: string;
  nights: number;
  roomCharges: number;
  otherServicesCharges: number;
  foodCharges?: number;
  waterCharges?: number;
  laundryCharges?: number;
  serviceCharges?: number;
  extraBedCharges?: number;
  extraPersonCharges?: number;
  earlyCheckInCharges?: number;
  lateCheckOutCharges?: number;
  fineCharges?: number;
  otherCharges?: number;
  subtotal?: number;
  discount: number;
  taxableAmount?: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  gstRate?: number;
  isWithoutGst?: boolean;
  isSeparateInvoice?: boolean;
  isFoodRoomSplitSettled?: boolean;
  parentInvoiceId?: string;
  invoiceStatus?: 'Draft' | 'Generated' | 'Finalized' | 'Cancelled' | 'Superseded';
  invoiceType?: string;
  isCreditNote?: boolean;
  isSuperseded?: boolean;
  supersededByInvoiceId?: string;
  supersededByInvoiceNumber?: string;
  supersededAt?: string;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  refundDue?: number;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid';
  paymentMethod: PaymentMethod;
  createdAt: string;
  ledgerLines?: any[];
  taxRows?: any[];
  amountInWords?: string;
  billEngine?: string;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  roomName: string;
  roomNumber: string;
  category: string;
  floor?: string;
  description: string;
  taskType: 'Cleaning' | 'SheetChange' | 'Inspection' | 'Maintenance';
  assignedTo: string;
  timing: string;
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  notes?: string;
  completedAt?: string;
  inspectedBy?: string;
  inspectedAt?: string;
  status: 'Pending' | 'In Progress' | 'Inspection' | 'Completed';
  checklist: string[];
  autoCreatedFromBookingId?: string;
}

export interface LaundryOrderRecord {
  id: string;
  orderNumber: string;
  orderType: 'Guest Laundry' | 'Hotel Linen';
  roomNumber?: string;
  guestName?: string;
  itemsSummary: string;
  totalAmount: number;
  paymentStatus: 'Billed to Room' | 'Paid' | 'Pending';
  deliveryStatus: 'Pending' | 'In Wash' | 'Ironing' | 'Ready' | 'Delivered';
  date: string;
  handledBy: string;
}

export interface LostFoundRecord {
  id: string;
  hotelId?: string;
  recordType?: 'found' | 'lost';
  itemName: string;
  category: string;
  description?: string;
  roomNumber: string;
  bookingId?: string;
  checkInId?: string;
  source?: string;
  locationFound?: string;
  foundBy: string;
  dateFound: string;
  storageLocation?: string;
  guestName?: string;
  guestMobile?: string;
  guestEmail?: string;
  dateReported?: string;
  lastSeenLocation?: string;
  reportedByStaff?: string;
  matchedItemId?: string;
  matchedItemName?: string;
  matchedBy?: string;
  matchedAt?: string;
  matchNotes?: string;
  status:
    | 'Lost – Reported'
    | 'Found – Registered'
    | 'Matching – In Progress'
    | 'Matched'
    | 'Stored'
    | 'Returned to Guest'
    | 'Closed'
    | 'Registered'
    | 'Claimed'
    | 'Disposed';
  claimedBy?: string;
  claimGuestMobile?: string;
  claimIdProof?: string;
  claimDate?: string;
  returnedBy?: string;
  returnNotes?: string;
  closedAt?: string;
  closedBy?: string;
  closedReason?: string;
  createdAt?: string;
  updatedAt?: string;
  auditHistory?: Array<{
    id?: string;
    action: string;
    fromStatus?: string;
    toStatus?: string;
    performedBy: string;
    dateTime: string;
    notes?: string;
  }>;
}

export interface PosMenuItem {
  id: string;
  code: string;
  name: string;
  category: string;
  subCategory?: string;
  price: number;
  costPrice?: number;
  taxRate: number;
  isVeg: boolean;
  available: boolean;
  isActive?: boolean;
  image?: string;
  description?: string;
  prepTime?: number;
  kitchenStation: 'Main Kitchen' | 'Tandoor' | 'Beverage Bar' | 'Bakery' | string;
  variants?: { id: string; name: string; price: number }[];
  addons?: { id: string; name: string; price: number }[];
  modifiers?: string[];
  mealWindows?: ('Breakfast' | 'Lunch' | 'Dinner' | 'All Day')[];
  stockTracking?: boolean;
  currentStock?: number;
  /** Recipe / Bill of Materials (BOM) linking warehouse inventory raw materials to menu dishes */
  recipeIngredients?: {
    inventoryItemId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
  }[];
}

export interface PosOrderRecord {
  id: string;
  orderNumber: string;
  orderType: 'Room Service' | 'Dine In' | 'Takeaway' | 'Delivery';
  roomNumber?: string;
  roomName?: string;
  bookingId?: string;
  tableNumber?: string;
  pax?: number;
  waiterName?: string;
  customerName: string;
  customerPhone: string;
  items: {
    itemId: string;
    name: string;
    qty: number;
    price: number;
    total: number;
    menuPrice?: number;
    overrideReason?: string;
    variant?: string;
    addons?: string[];
    addonPriceTotal?: number;
    kitchenStation?: string;
    itemNotes?: string;
    itemDiscount?: number;
    itemStatus?: 'KOT Sent' | 'Accepted' | 'Preparing' | 'Ready' | 'Served';
  }[];
  subtotal: number;
  discount: number;
  packagingCharge?: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'Paid' | 'Unpaid (Room Folio)' | 'Partially Paid' | 'Unpaid';
  kotStatus: 'KOT Sent' | 'Kitchen Accepted' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled';
  instructions?: string;
  dateTime: string;
  /** Individual payments (Hybrid / Partial / single). Truth for per-mode reporting. */
  payments?: PosPaymentRecord[];
  amountPaid?: number;
  balanceDue?: number;
  paymentSummary?: string;
  /** Dine-in check that is still open (table not billed yet). Supplementary KOTs share the same checkId. */
  isOpenCheck?: boolean;
  isHeld?: boolean;
  holdNote?: string;
  checkId?: string;
  kotNumber?: string;
  isSupplementaryKot?: boolean;
  reprintCount?: number;
  pickupTime?: string;
  pickupStatus?: 'Preparing' | 'Ready for Pickup' | 'Picked Up / Delivered';
  advanceBookingId?: string;
  advanceDepositApplied?: number;
  isWithoutGst?: boolean;
  gstRate?: number;
  customerGstin?: string;
  companyName?: string;
  voidedAt?: string;
  voidReason?: string;
  voidedBy?: string;
  refundAmount?: number;
  discountMeta?: { type: 'percent' | 'fixed'; value: number; amount: number; couponCode?: string; reason: string; by: string; at: string };
  settlement?: { originalAmount: number; finalAmount: number; adjustment: number; reason: string; authorisedBy: string; at: string };
  priceOverrides?: { itemId: string; name: string; originalPrice: number; newPrice: number; reason: string; by: string; at: string }[];
  bomDeducted?: boolean;
  bomReversed?: boolean;
  bomDeductionSnapshot?: { inventoryItemId: string; ingredientName: string; deductedQty: number; unit: string }[];
}

export interface PosPaymentRecord {
  id: string;
  method: string;
  amount: number;
  reference?: string;
  time: string;
  staff: string;
  // Manual Verification & Detail Fields
  upiUtr?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationStatus?: 'Verified' | 'Pending' | 'verified' | 'unverified';
  cardNetwork?: 'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Other' | string;
  cardLast4?: string;
  cardTerminal?: string;
  bankName?: string;
  bankRef?: string;
  cashTendered?: number;
  changeReturned?: number;
  notes?: string;
}

export interface InventoryItemRecord {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
  currentStock: number;
  minStock: number;
  supplierName: string;
  lastUpdated: string;
}

export interface InventorySupplierRecord {
  id: string;
  name: string;
  contactPerson: string;
  mobile: string;
  gstin: string;
  category: string;
  city: string;
  balancePayable: number;
}

export interface InventoryPurchaseRecord {
  id: string;
  poNumber: string;
  supplierName: string;
  itemsSummary: string;
  date: string;
  totalAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  status: 'Received' | 'Ordered';
}

export interface StockMovementRecord {
  id: string;
  date: string;
  productName: string;
  type: 'IN' | 'OUT';
  qty: number;
  department: string;
  reason: string;
  handledBy: string;
}

export interface BookingChangeHistoryItem {
  id: string;
  timestamp: string;
  eventType: 'CREATED' | 'MODIFIED' | 'CANCELLED' | 'CONFIRMED' | 'ROOM_ASSIGNED';
  actor: string;
  summary: string;
  previousDates?: string;
  newDates?: string;
  previousRoom?: string;
  newRoom?: string;
  previousAmount?: number;
  newAmount?: number;
}

export interface OtaChannelRecord {
  id: string;
  hotelId?: string;
  name: string;
  logoBadge: string;
  connected: boolean;
  hotelCode: string;
  apiKey?: string;
  apiSecret?: string;
  maskedApiKey?: string;
  hasSavedSecret?: boolean;
  apiEndpointUrl?: string;
  webhookUrl?: string;
  authType?: 'API Key + Secret' | 'OAuth2 Bearer' | 'XML Channel Manager' | string;
  commissionPercent: number;
  markupPercent: number;
  lastSync: string;
  lastSyncError?: string;
  bookingsCount: number;
  revenueGenerated: number;
  status:
    | 'Healthy'
    | 'Pending Configuration'
    | 'Pending Official OTA Endpoint'
    | 'Auth Error'
    | 'Sync Failed'
    | 'Syncing'
    | 'Disconnected';
}

export interface OtaRoomMappingRecord {
  id: string;
  hotelId?: string;
  channelId: string;
  channelName: string;
  pmsCategoryId: string;
  pmsCategoryName: string;
  otaRoomTypeCode: string;
  otaRoomTypeName: string;
  standardOccupancy: number;
  maxOccupancy: number;
  mealPlan: 'EP (Room Only)' | 'CP (Breakfast Included)' | 'MAP (Breakfast + Dinner)' | 'AP (All Meals)' | string;
  ratePlanCode: string;
  status: 'Active' | 'Inactive' | 'Pending Sync';
  updatedAt: string;
}

export interface OtaSeasonalRateOverride {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  price: number;
  minStayNights: number;
}

export interface OtaRateRuleRecord {
  id: string;
  hotelId?: string;
  channelId: string;
  channelName: string;
  pmsCategoryName: string;
  pmsBasePrice: number;
  otaBasePrice: number;
  weekdayRate: number;
  weekendRate: number;
  extraPersonCharge: number;
  mealPlan: string;
  mealPlanAddonPrice: number;
  ratePlanCode: string;
  minStayNights: number;
  maxStayNights: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  seasonalOverrides: OtaSeasonalRateOverride[];
  updatedAt: string;
}

export interface OtaInventoryAllocationRecord {
  id: string;
  hotelId?: string;
  pmsCategoryName: string;
  channelId: string;
  channelName: string;
  date: string;
  allocatedRooms: number;
  stopSell: boolean;
  updatedAt: string;
}

export interface OtaSettlementRecord {
  id: string;
  hotelId?: string;
  channelId: string;
  channelName: string;
  settlementRef: string;
  payoutDate: string;
  grossBookingValue: number;
  commissionDeducted: number;
  tdsOrTaxDeducted: number;
  netSettledAmount: number;
  bookingIds: string[];
  notes: string;
  recordedBy: string;
}

export interface OtaSyncLogRecord {
  id: string;
  hotelId?: string;
  timestamp: string;
  channelId: string;
  channelName: string;
  eventType:
    | 'API_TEST'
    | 'CREDENTIAL_UPDATE'
    | 'RATE_PUSH'
    | 'INVENTORY_PUSH'
    | 'FULL_ARI_PUSH'
    | 'WEBHOOK_BOOKING_NEW'
    | 'WEBHOOK_BOOKING_MODIFY'
    | 'WEBHOOK_BOOKING_CANCEL'
    | 'AUTH_ERROR';
  direction: 'OUTBOUND_PUSH' | 'INBOUND_WEBHOOK' | 'AUTH_CHECK';
  endpoint: string;
  httpStatus: number;
  status: 'SUCCESS' | 'PENDING_ENDPOINT' | 'FAILED' | 'RETRIED';
  latencyMs: number;
  errorMessage?: string;
  sanitizedPayload: string;
  retryPayload?: any;
  retryCount: number;
}

export interface FinanceExpenseRecord {
  id: string;
  hotelId?: string;
  expenseNo: string;
  date: string;
  category: string;
  customCategory?: string;
  department: string;
  vendorName: string;
  description: string;
  amount: number;
  gstRate?: number;
  gstAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: 'Paid' | 'Pending / Payable';
  amountPaid?: number;
  outstandingAmount?: number;
  paidDate?: string;
  invoiceNumber?: string;
  billAttachment?: string;
  approvalStatus: 'Approved' | 'Pending' | 'Rejected';
  recordedBy: string;
  remarks?: string;
  sourceType?: 'manual_expense' | 'inventory_purchase' | 'reimbursement' | 'vendor_bill' | 'ota_commission';
  sourceId?: string;
}

export interface FinanceVoucherRecord {
  id: string;
  hotelId?: string;
  voucherNo: string;
  type: 'Payment Voucher' | 'Receipt Voucher';
  date: string;
  partyName: string;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo: string;
  narration: string;
  preparedBy: string;
  sourceType?: string;
  sourceId?: string;
}

export interface CashBankAccountRecord {
  id: string;
  hotelId?: string;
  accountName: string;
  accountType: 'Cash Drawer' | 'Bank Account' | 'UPI Merchant' | 'POS Card Terminal' | 'Petty Cash';
  bankName?: string;
  accountNumber: string;
  accountReference?: string;
  openingBalance: number;
  openingDate?: string;
  inflowTotal: number;
  outflowTotal: number;
  currentBalance: number;
  lastReconciled: string;
  status?: 'Active' | 'Inactive';
}

export interface PettyCashRecord {
  id: string;
  hotelId?: string;
  date: string;
  type: 'Inflow' | 'Outflow';
  category: string;
  amount: number;
  handler: string;
  notes: string;
  sourceAccount?: string;
  sourceAccountId?: string;
  receiptReference?: string;
  paidTo?: string;
  isReplenishment?: boolean;
  sourceType?: string;
  sourceId?: string;
}

export interface VendorBillRecord {
  id: string;
  hotelId?: string;
  vendorId?: string;
  vendorName: string;
  vendorCategory: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  purchaseOrderRef?: string;
  invoiceAmount: number;
  gstRate?: number;
  gstAmount?: number;
  paymentTerms?: string;
  attachmentName?: string;
  paidAmount: number;
  remainingPayable: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  payments?: Array<{
    id: string;
    date: string;
    amount: number;
    paymentMethod: PaymentMethod;
    voucherNo?: string;
    referenceNo?: string;
    notes?: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface MiscellaneousIncomeRecord {
  id: string;
  hotelId?: string;
  incomeCategory: 'Banquet Hall' | 'Conference Hall' | 'Extra Mattress' | 'Walk-in Laundry' | 'Scrap Sale' | 'Other Income (Custom)' | string;
  customCategory?: string;
  description: string;
  amount: number;
  gstRate: number; // 0, 5, 12, 18
  gstAmount: number;
  paymentMode: PaymentMethod;
  transactionDate: string;
  referenceNumber: string;
  voucherNumber: string;
  remarks?: string;
  createdAt: string;
}

export interface OwnerPaymentRecord {
  id: string;
  date: string;
  directorName: string;
  type: 'Owner Withdrawal / Drawing' | 'Capital Injection' | 'Director Remuneration' | 'Profit Distribution';
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo: string;
  notes: string;
}

export interface StaffReimbursementRecord {
  id: string;
  date: string;
  staffName: string;
  department: string;
  title: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Paid';
}

export interface DailyClosingEntry {
  id: string;
  date: string;
  openingCash: number;
  roomCashIn: number;
  posCashIn: number;
  cashExpensesOut: number;
  expectedClosing: number;
  physicalCounted: number;
  discrepancy: number;
  closedBy: string;
  status: 'Balanced' | 'Discrepancy Logged';
}

export interface StaffMemberRecord {
  id: string;
  name: string;
  role: 'Admin' | 'Manager' | 'Receptionist' | 'Housekeeping' | 'Accounts' | 'Kitchen Chef' | 'Security';
  department: 'Front Office' | 'Housekeeping' | 'Accounts' | 'F&B Kitchen' | 'Management' | 'Security';
  mobile: string;
  username: string;
  password?: string;
  shift: 'Morning (7AM–3PM)' | 'Evening (3PM–11PM)' | 'Night Audit (11PM–7AM)' | string;
  salary: number;
  joiningDate: string;
  status: 'Active' | 'On Leave';
  checkInsHandled: number;
  roomsCleaned: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  module: string;
  action: string;
  details: string;
  severity: 'info' | 'success' | 'warning';
}

export interface NotificationEntry {
  id: string;
  title: string;
  message: string;
  type: 'booking' | 'checkin' | 'checkout' | 'payment' | 'housekeeping' | 'pos' | 'finance' | 'ota';
  severity: 'info' | 'success' | 'warning';
  createdAt: string;
  isRead: boolean;
  targetModule: string;
  targetSubTab?: string;
}

export interface WaterBottleLogEntry {
  id: string;
  date: string;
  dateTime?: string;
  roomNumber: string;
  bookingId?: string;
  checkInId?: string;
  guestName: string;
  qty: number;
  complimentaryCount?: number;
  extraChargeableCount?: number;
  ratePerBottle?: number;
  isChargeable: boolean;
  amount: number;
  deliveredBy: string;
}
