export type RoomCategory = string;

export type RoomStatus = 'Available' | 'Occupied' | 'Reserved' | 'Maintenance' | 'Dirty' | 'Clean' | 'Inspection' | 'Out of Order' | 'Out of Service' | 'Blocked';

export type CleaningStatus = 'Clean' | 'Dirty' | 'In Progress' | 'Ready For Guest' | 'Needs Inspection';

export interface PackageModulePermissions {
  ota: boolean;            // OTA Channel Manager
  staff: boolean;          // Staff Management & Attendance/Roster
  reports: boolean;        // Advanced Daily & Financial Reports
  cashHandover: boolean;   // Cash Handover & Shift Audit
  expenses: boolean;       // Expense Accounting
  invoices: boolean;       // GST Invoices & Billing Engine
  policies: boolean;       // House Rules & Policy Manager
  website: boolean;        // Direct Booking Website Engine
  pos?: boolean;           // POS Terminal & Food Billing
  inventory?: boolean;     // Inventory Store & Stock Management
}

export interface SaaSPackage {
  id: string;
  name: string;               // e.g., "Starter / Basic", "Growth Standard", "Premium Luxury", "Enterprise Scale"
  tagline?: string;
  priceMonthly: number;       // e.g. 999 INR
  priceYearly: number;        // e.g. 9999 INR
  maxRooms: number;           // Max number of rooms allowed (e.g. 15, 30, 50, 100, 999 for Unlimited)
  roomTierLabel?: string;     // e.g. "Up to 15 Rooms Capacity"
  badge?: string;             // e.g., "Popular", "Starter", "Best Value", "Enterprise"
  billingCycle?: 'Monthly' | 'Yearly' | 'Both';
  modules: PackageModulePermissions;
  description?: string;
}

export interface SubscriptionRenewalRequest {
  id: string;
  hotelId: string;
  hotelName: string;
  requestedPackageId?: string;
  requestedPackageName: string;
  requestedPlan: 'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly';
  requestedAmount: number;
  paymentMethod: string;
  transactionReference?: string;
  notes?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedAt: string;
  requestedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SubscriptionInvoice {
  id: string;
  invoiceNumber: string;
  hotelId: string;
  hotelName: string;
  ownerName?: string;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  hotelGst?: string;
  packageId?: string;
  packageName: string;
  subscriptionPlan: 'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly';
  roomCapacityLabel: string;
  includedModules: string[];
  validFrom: string;
  validUntil: string;
  baseAmount: number;
  gstRate: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
  paymentMethod: string;
  transactionReference?: string;
  paymentStatus: 'Paid' | 'Pending';
  approvedBy: string;
  createdAt: string;
  notes?: string;
}

export interface Hotel {
  id: string;
  name: string;
  address: string;
  gstNumber: string;
  phoneNumber: string;
  emailAddress: string;
  website: string;
  logoUrl: string;
  packageId?: string;
  subscriptionPlan?: 'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly';
  subscriptionStatus?: 'Active' | 'Expired' | 'Pending';
  subscriptionPrice?: number;
  trialStartDate?: string;
  subscriptionEndDate?: string;
  roomTierLimit?: '1-10' | '10-20' | '20-30' | '30-50';
  username?: string;
  password?: string;
  ownerName?: string;
  panNumber?: string;
  checkInTime?: string;
  checkOutTime?: string;
  earlyCheckInEnabled?: boolean;
  earlyCheckInType?: 'hourly' | 'fixed';
  earlyCheckInHourlyRate?: number;
  earlyCheckInFixedRate?: number;
  currency?: string;
  timeZone?: string;
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | string;
  businessDate?: string;
  lastNightAuditAt?: string;
  whatsappNumber?: string;
  emailSettings?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    secure?: boolean;
  };
  invoicePrefix?: string;
  nextInvoiceSequence?: number;
  isGstEnabled?: boolean;
  defaultGstRate?: number;
  foodGstRate?: number;
  roomRateIncludesGst?: boolean;
  taxOnAncillary?: boolean;
  waterBottleRate?: number;
  grcPrefix?: string;
  nextGrcSequence?: number;
  grcTerms?: string[];
  placeOfSupply?: string;
  gstSlabs?: number[];
  invoiceConditions?: InvoiceConditionsConfig;
  status?: 'Approved' | 'Pending' | 'Rejected' | 'Suspended';
  externalPaymentLink?: string;
  ownerUsername?: string;
  ownerPassword?: string;
  renewalRequest?: SubscriptionRenewalRequest;
  subscriptionInvoices?: SubscriptionInvoice[];
}

export interface Room {
  id: string;
  hotelId?: string;
  number: string;
  category: RoomCategory;
  rate: number;
  status: RoomStatus;
  cleaningStatus?: CleaningStatus;
  assignedStaff?: string;
  verifiedBy?: string;
  verificationTime?: string;
  maxOccupancy?: number;
  baseOccupancy?: number;
  extraPersonCharge?: number;
  floor?: string;
  bedType?: string;
  amenities?: string[];
  images?: string[];
  outOfOrderReason?: string;
  weekendRate?: number;
  seasonalRate?: number;
  allowExtraBed?: boolean; // Hotel config: whether an extra mattress/bed physically fits in this room
}

export interface RoomUpgradeRecord {
  id: string;
  bookingId: string;
  guestName: string;
  oldRoomNumber: string;
  oldRoomCategory: string;
  oldRoomRate: number;
  newRoomNumber: string;
  newRoomCategory: string;
  newRoomRate: number;
  remainingNights: number;
  rateDifferencePerNight: number;
  totalUpgradeCharge: number;
  upgradedAt: string;
  upgradedBy?: string;
  reason?: string;
}

export type BookingStatus = 'Confirmed' | 'Pending' | 'Waiting' | 'In Process' | 'Advance' | 'Cancelled' | 'Checked In';

export type BookingSource =
  | 'Direct'
  | 'Walk-in'
  | 'Phone'
  | 'Website'
  | 'Travel Agent'
  | 'Corporate'
  | 'OYO'
  | 'Agoda'
  | 'Booking.com'
  | 'Goibibo'
  | 'MakeMyTrip'
  | 'Other'
  | string;

export type PaymentMethod = 'Cash' | 'Online' | 'Card' | 'UPI' | 'Bank Transfer' | 'Voucher' | string;

export type MealPlanType = 'EP' | 'CP' | 'MAP' | 'AP';

export interface Booking {
  id: string; // Booking ID e.g., GP-BKG-1001
  bookedServices?: BookedServiceSelection[]; // optional hotel services ticked by the admin (charged only when ticked)
  hotelId?: string;
  guestName: string;
  mobile: string;
  email: string;
  aadhaarNumber: string;
  address: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  nights: number;
  adults: number;
  children: number;
  roomNumber: string;
  roomType: RoomCategory;
  advanceAmount: number;
  paymentMethod: PaymentMethod;
  bookingSource: BookingSource;
  status: BookingStatus;
  notes?: string;
  isCheckedIn?: boolean;
  
  // Payment Tracking
  bookingAmount?: number;
  gstRate?: number;
  gstAmount?: number;
  isWithoutGst?: boolean;
  paymentStatus?: 'Unpaid' | 'Partially Paid' | 'Fully Paid' | 'Payment Failed' | 'Refunded';
  transactionId?: string;
  bookingDate?: string;
  refundAmount?: number;
  refundMode?: string;
  refundReference?: string;
  refundDate?: string;
  cancellationReason?: string;
  paymentFailureReason?: string;
  isCompleted?: boolean;
  
  // Optional Fields
  alternateMobile?: string;
  emailAddress?: string;
  vehicleNumber?: string;
  companyName?: string;
  gstNumber?: string;
  passportNumber?: string;
  nationality?: string;
  
  bookedRooms?: BookedRoom[];

  // Group Check-in
  isGroupCheckIn?: boolean;
  groupBookingId?: string;
  groupName?: string;

  // Extra Bed
  hasExtraBed?: boolean;
  extraBedCount?: number;
  extraBedRate?: number;
  extraBedTotal?: number;

  // C-Form
  cFormData?: CFormData;

  // Upgrade History
  upgradeHistory?: RoomUpgradeRecord[];

  // Hourly Stay & Early Check-In
  checkInTime?: string;
  checkOutTime?: string;
  isHourlyStay?: boolean;
  stayHours?: number;
  isEarlyCheckIn?: boolean;
  earlyCheckInHours?: number;
  earlyCheckInCharge?: number;

  // Audit details
  createdBy?: string;
  updatedBy?: string;

  // Reservation & Corporate / Travel Agent / Meal Plan Extensions
  mealPlan?: MealPlanType;
  maleCount?: number;
  femaleCount?: number;
  childCount?: number;
  purposeOfVisit?: string;
  comingFrom?: string;
  goingTo?: string;
  arrivalDateInIndia?: string;
  durationOfStayInIndia?: string;
  dob?: string;
  occupancyType?: 'Single' | 'Double';
  singleRate?: number;
  doubleRate?: number;
  voucherNumber?: string;
  isCorporateBooking?: boolean;
  travelAgentId?: string;
  travelAgentName?: string;
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
  commissionAmount?: number;
  commissionPaidAmount?: number;
  commissionStatus?: 'Pending' | 'Partially Paid' | 'Paid';
  guestSignatureData?: string;
  receptionistSignatureData?: string;
  checkedInBy?: string;
  checkInTimestamp?: string;
}

export interface BookedRoom {
  roomNumber: string;
  category: RoomCategory;
  rate: number;          // nightly price (after direct edit/discount calculation)
  originalRate: number;  // standard standard price per night
  discountAmountOfRoom: number; // originalRate - rate
  guestsCount: number;   // how many guests assigned to this room
  extraGuestsCount: number; // guestsCount - baseOccupancy
  extraPersonChargeApplied: number; // extraGuestsCount * extraPersonCharge
  totalRoomAmount: number; // (rate + extraPersonChargeApplied) * nights

  // Extra Bed
  hasExtraBed?: boolean;
  extraBedCount?: number;
  extraBedRate?: number;
  extraBedTotal?: number;

  // Group guest assignment
  guestName?: string;
  guestMobile?: string;
  guestIdType?: string;
  guestIdNumber?: string;
  occupancyType?: 'Single' | 'Double';
  maleCount?: number;
  femaleCount?: number;
  childCount?: number;
}

export interface CFormData {
  id?: string;
  checkInId?: string;
  guestName: string;
  gender?: 'Male' | 'Female' | 'Other';
  dob?: string;
  nationality: string;
  passportNumber: string;
  passportCountry: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  visaNumber: string;
  visaType: string; // 'Tourist', 'Business', 'Conference', 'Student', 'Medical', 'Employment', 'Other'
  visaIssueDate?: string;
  visaExpiryDate?: string;
  visaPlaceOfIssue?: string;
  arrivalDateInIndia: string;
  portOfArrivalInIndia: string;
  addressInHomeCountry: string;
  cityInHomeCountry?: string;
  countryInHomeCountry?: string;
  contactInIndia?: string;
  addressInIndia?: string;
  purposeOfVisit: string;
  nextDestination: string;
  nextDestinationCountry?: string;
  cFormNumber?: string;
  status: 'Pending' | 'Generated' | 'Submitted';
  generatedAt?: string;
}

export interface GuestCheckIn {
  id: string; // Same as Booking ID or custom
  hotelId?: string;
  guestName: string;
  mobile: string;
  alternateMobile?: string;
  aadhaarNumber: string;
  passportNumber?: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  
  // Optional/new fields
  vehicleNumber?: string;
  companyName?: string;
  emailAddress?: string;
  gstNumber?: string;
  
  // Documents (URLs or base64 keys)
  aadhaarUploadName?: string;
  aadhaarUploadData?: string;
  passportUploadName?: string;
  passportUploadData?: string;
  guestPhotoData?: string; // Captured photo
  // Stay
  checkInDate: string;
  checkOutDate: string;
  nights?: number;
  stayNights?: number;
  arrivalTime?: string;
  departureTime?: string;
  isHourlyStay?: boolean;
  stayHours?: number;
  isEarlyCheckIn?: boolean;
  earlyCheckInHours?: number;
  earlyCheckInCharge?: number;
  numGuests: number;
  roomNumber: string;
  roomRate: number;
  // Payments
  totalAmount: number;
  baseAmount?: number;
  taxAmount?: number;
  otherCharges?: number;
  gstRate?: number;
  gstAmount?: number;
  isWithoutGst?: boolean;
  advanceAmount: number;
  cashAmountPaid: number;
  onlineAmountPaid: number;
  pendingAmount: number;
  dateTime: string;
  secondaryGuests?: SecondaryGuest[];
  
  bookedRooms?: BookedRoom[];

  // Group Check-in
  isGroupCheckIn?: boolean;
  groupBookingId?: string;
  groupName?: string;

  // Extra Bed
  hasExtraBed?: boolean;
  extraBedCount?: number;
  extraBedRate?: number;
  extraBedTotal?: number;

  // C-Form
  cFormData?: CFormData;
  isCFormRequired?: boolean;
  isCFormSubmitted?: boolean;

  // Payments History & Extra Charges
  payments?: PaymentRecord[];
  extraCharges?: ExtraCharge[];
  depositBalance?: number;
  idProofFileName?: string;
  idProofFileData?: string;

  // Price Override & Occupancy Charges Tracking
  originalRate?: number;
  discountAmount?: number;
  discount?: number;
  bookingId?: string;
  extraPersonChargeApplied?: number;
  extraPersonChargesApplied?: number;
  overriddenBy?: string;
  overrideReason?: string;
  
  // New Hotel Registration Fields
  idType?: string;
  idNumber?: string;
  country?: string;
  
  // Audit & Verification Signature fields
  checkedInBy?: string;
  checkedOutBy?: string;
  checkedOutDateTime?: string;
  /** Snapshot taken at check-out so the check-out can be reverted (Undo) within 24 hours. */
  checkoutUndoSnapshot?: any;
  checkoutUndoneAt?: string;
  checkoutUndoneBy?: string;
  guestSignatureData?: string;
  receptionistSignatureData?: string;
  checkInTimestamp?: string;

  // Walk-in / Reservation Metadata
  bookingDate?: string;
  bookingSource?: BookingSource;
  bookingStatus?: BookingStatus;

  // Upgrade History
  upgradeHistory?: RoomUpgradeRecord[];

  // Allocated Guest Services (Complimentary or Chargeable)
  allocatedServices?: AllocatedGuestService[];

  // GRC & Reservation Extensions
  dob?: string;
  purposeOfVisit?: string;
  comingFrom?: string;
  goingTo?: string;
  arrivalDateInIndia?: string;
  durationOfStayInIndia?: string;
  maleCount?: number;
  femaleCount?: number;
  childCount?: number;
  adults?: number;
  children?: number;
  roomType?: string;
  paymentMethod?: string;
  status?: string;
  mealPlan?: MealPlanType;
  voucherNumber?: string;
  grcNumber?: string;
  travelAgentId?: string;
  travelAgentName?: string;
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
  commissionAmount?: number;
}

export interface BookedServiceSelection {
  serviceId: string;
  serviceName: string;
  amount: number;
}

export interface GuestServiceItem {
  id: string;
  hotelId?: string;
  name: string;
  amount: number;
  createdAt?: string;
  createdBy?: string;
}

export interface AllocatedGuestService {
  id: string;
  requestId?: string;
  hotelId?: string;
  serviceId: string;
  serviceName: string;
  category?: string;
  configuredAmount: number;
  chargedAmount: number;
  isChargeable: boolean;
  roomNumber: string;
  checkInId: string;
  guestName: string;
  allocatedBy?: string;
  dateTime: string;
}

export interface SecondaryGuest {
  fullName: string;
  mobile?: string;
  address?: string;
  aadhaarNumber?: string;
  passportNumber?: string;
  nationality: string;
  idType?: string;
  idNumber?: string;
}

export type VerificationStatus = 'Approved' | 'Pending' | 'Issue Found';

export interface RoomVerification {
  id: string; // matches checkInId or bookingId
  hotelId?: string;
  roomNumber: string;
  verifiedBy: string; // Housekeeping or Supervisor Name
  isRoomChecked: boolean;
  isNoDamageFound: boolean;
  isMiniBarChecked: boolean;
  isWaterBottlesVerified: boolean;
  isLaundryVerified: boolean;
  status: VerificationStatus;
  dateTime: string;
  notes?: string;
}

export interface RolePermission {
  id: string;
  hotelId: string;
  roleName: string; // e.g., 'Manager', 'Receptionist', 'Cashier', 'Accountant', 'Housekeeping', 'Kitchen', 'Security', 'Maintenance', or custom names
  isCustom?: boolean;
  canManageBookings: boolean;
  canManageRooms: boolean;
  canManageStaff: boolean;
  canManageExpenses: boolean;
  canManageHandovers: boolean;
  canViewReports: boolean;
  canManageOta: boolean;
  canManagePolicies: boolean;
}

export type Department = 'Reception' | 'Housekeeping' | 'Accounts' | 'Manager' | 'Admin' | 'Kitchen' | 'Security' | 'Maintenance' | 'Other';
export type StaffStatus = 'Active' | 'Inactive';

export interface Staff {
  id: string;
  hotelId?: string;
  name: string;
  mobile: string;
  address?: string;
  department: Department;
  designation: string;
  role?: string; // staff role mapped to roleName in RolePermission
  allowedModules?: string[]; // explicit list of PMS module IDs this staff member can access
  joiningDate: string;
  username: string;
  password?: string;
  plainPassword?: string;
  photoData?: string;
  status: StaffStatus;
  salary?: number;
  salaryStatus?: 'Paid' | 'Pending';
  lastSalaryPaidDate?: string;
  shiftTiming?: string;
  // Performance attributes
  checkInsCount?: number;
  checkOutsCount?: number;
  roomsCleanedCount?: number;
  bookingsCreatedCount?: number;
  revenueGeneratedSum?: number;
}

export interface AuditLog {
  id: string;
  hotelId?: string;
  action: string; // 'Check-In' | 'Check-Out' | 'Room Verification' | 'Booking Edit' | 'Add Charges' | 'Delete' etc
  performedBy: string;
  actorId?: string;
  actorUsername?: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  outcome?: 'success' | 'blocked' | 'failed';
  details: string;
  dateTime: string;
  requestId?: string;
  persistedAt?: string;
}

export interface WaterBottleRecord {
  id: string;
  hotelId?: string;
  roomNumber: string;
  quantity: number;
  date: string; // YYYY-MM-DD
  type?: 'Chargeable' | 'Complimentary' | string;
  isChargeable?: boolean;
  unitPrice?: number;
  totalAmount?: number;
  chargeAmount?: number;
  deliveredBy?: string;
  dateTime?: string;
  recordType?: 'water' | 'service_catalog' | 'service_allocation';
  serviceId?: string;
  serviceName?: string;
  configuredAmount?: number;
  checkInId?: string;
  checkinId?: string;
  folioChargeId?: string;
  guestName?: string;
  requestId?: string;
  bookingId?: string;
}

export interface Invoice {
  id: string; // e.g. GP-INV-1001
  hotelId?: string;
  invoiceNumber: string;
  bookingId: string;
  checkInId?: string;
  guestName: string;
  guestMobile?: string;
  mobile?: string;
  guestGstNumber?: string;
  gstNumber?: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  roomCharges: number;
  foodCharges: number;
  waterCharges: number;
  otherCharges: number;
  additionalCharges?: number;
  serviceCharges?: number;
  laundryCharges?: number;
  extraChargesTotal?: number;
  taxableAmount?: number;
  extraPersonCharges?: number;
  extraBedCharges?: number;
  extraBedCount?: number;
  extraBedRate?: number;
  isGroupCheckIn?: boolean;
  groupBookingId?: string;
  bookedRooms?: BookedRoom[];
  subtotal: number;
  gst: number; // calculated total GST
  roomGst?: number;
  foodGst?: number;
  otherGst?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  discount: number;
  finalAmount: number;
  totalAmount?: number;
  grandTotal?: number;
  balanceAmount?: number;
  balanceDue?: number;
  dateCreated: string;
  date?: string;
  dueDate?: string;
  invoiceStatus?: 'Draft' | 'Generated' | 'Finalized' | 'Cancelled' | 'Superseded';
  isFinalInvoice?: boolean;
  isPaid: boolean;
  paymentStatus?: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Cancelled' | 'Refunded' | 'Payment Failed';
  refundAmount?: number;
  refundMode?: string;
  refundDate?: string;
  paymentFailureReason?: string;
  gstRate?: number;
  advancePaid?: number;
  amountPaid?: number;
  outstandingAmount?: number;
  pendingAmount?: number;
  paymentMethod?: string;
  invoiceType?: 'Booking Invoice' | 'Stay Checkout Invoice' | 'Proforma Invoice' | 'Tax Invoice' | 'Bill of Supply';
  isWithoutGst?: boolean;
  isSeparateInvoice?: boolean;
  parentInvoiceId?: string;
  receiverName?: string;
  guestAddress?: string;
  companyName?: string;
  nationality?: string;
  voucherNumber?: string;
  grcNumber?: string;
  arrivalTime?: string;
  departureTime?: string;
  notes?: string;
  paymentHistory?: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    date: string;
    referenceNo?: string;
    recordedBy?: string;
    notes?: string;
  }>;
  isDemoData?: boolean;
  // Single Bill Calculator (billEngine 'v2') fields — additive, all optional
  earlyCheckInCharges?: number;
  lateCheckOutCharges?: number;
  fineCharges?: number;
  taxRows?: Array<{ rate: number; taxable: number; cgst: number; sgst: number; tax: number }>;
  ledgerLines?: Array<{ type: string; dateLabel: string; roomNumber: string; description: string; sac: string; charges: number; receipts: number; kind?: string; sourceId?: string }>;
  amountInWords?: string;
  billEngine?: string;
  refundDue?: number;
  paidAmount?: number;
  invoiceScope?: 'Only Booking' | 'Only Other Services' | 'Booking + Other Services';
  isSuperseded?: boolean;
  supersededByInvoiceId?: string;
  supersededByInvoiceNumber?: string;
  supersededAt?: string;
  roomNumbers?: string[];
  nights?: number;
}

export type ExpenseCategory = 
  | 'Room Operations' 
  | 'Housekeeping' 
  | 'Laundry' 
  | 'Restaurant & Kitchen' 
  | 'Grocery' 
  | 'Inventory Purchases' 
  | 'Maintenance' 
  | 'Utilities' 
  | 'Staff Salary & Welfare' 
  | 'Marketing' 
  | 'Office Expenses' 
  | 'Fuel & Transport' 
  | 'Taxes & Licenses' 
  | 'Miscellaneous'
  | 'Food Expense' 
  | 'Labor Expense' 
  | 'Maintenance Expense' 
  | 'Utility Expense' 
  | 'Other Expense';

export interface Expense {
  id: string;
  hotelId?: string;
  expenseNo?: string;
  branchName?: string;
  department?: string;
  category: ExpenseCategory | string;
  subcategory?: string;
  vendorId?: string;
  vendorName?: string;
  vendorGstNumber?: string;
  invoiceReference?: string;
  date: string;
  dueDate?: string;
  description: string;
  baseAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  gstAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  amount: number; // Total Amount
  amountPaid?: number;
  outstandingAmount?: number;
  paymentSource?: 'Petty Cash' | 'Bank Account' | 'UPI' | 'Card' | 'Owner/Director' | 'Credit/Vendor Payable' | string;
  paymentMethod?: 'Cash' | 'Online Transfer' | 'Bank Transfer' | 'UPI' | 'Card' | 'Cheque' | 'Credit' | string;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Partial' | 'Partially Paid' | string;
  paidDate?: string;
  paidBy?: string;
  paymentReference?: string;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected' | string;
  status?: 'Pending' | 'Approved' | 'Rejected' | string;
  approvedBy?: string;
  approvedDate?: string;
  approvalNotes?: string;
  billFileName?: string;
  billFileData?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'Monthly' | 'Quarterly' | 'Yearly' | string;
  notes?: string;
  createdBy?: string;
  sourceType?: 'manual_expense' | 'inventory_purchase' | 'reimbursement' | 'recurring';
  sourceId?: string;
  idempotencyKey?: string;
  isDemoData?: boolean;
  auditHistory?: Array<{
    action: string;
    status: string;
    performedBy: string;
    dateTime: string;
    notes?: string;
  }>;
}

export interface RecurringExpenseSchedule {
  id: string;
  hotelId?: string;
  title: string;
  department: string;
  category: string;
  vendorName?: string;
  estimatedAmount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly';
  dueDayOfMonth: number;
  paymentSource: string;
  isActive: boolean;
  lastGeneratedDate?: string;
  notes?: string;
}

export interface ExpenseCategoryDefinition {
  id: string;
  hotelId?: string;
  department: string;
  categoryName: string;
  subcategories: string[];
  monthlyBudgetLimit?: number;
  notes?: string;
}

export interface CashHandover {
  id: string;
  hotelId?: string;
  date: string;
  amount: number;
  receivedBy: string; // e.g. "Raghu Sir"
  notes: string;
}

export interface PriceOverrideLog {
  id: string;
  hotelId?: string;
  roomNumber: string;
  guestName: string;
  originalRate: number;
  newRate: number;
  discountAmount: number;
  staffName: string;
  dateTime: string;
}

export type UserRole = 'Admin' | 'Reception' | 'Housekeeping' | 'Accounts' | 'Owner' | 'Manager' | 'Receptionist' | 'SuperAdmin';

export interface HotelPolicy {
  id: string;
  hotelId?: string;
  category: 'Check-in' | 'Check-out' | 'Refund' | 'Cancellation' | 'Visitor';
  title: string;
  content: string;
}

export type InvoiceTriggerEvent = 'checkout' | 'checkin' | 'booking_confirmation' | 'manual_only';
export type InvoiceGenerationMode = 'auto_and_manual' | 'auto_only' | 'manual_only';

export interface InvoiceConditionsConfig {
  // 1. Invoice Generation Trigger
  triggerEvent: InvoiceTriggerEvent;
  // 2. Booking Status Condition
  allowedBookingStatuses: string[];
  // 3. Payment Status Condition
  allowedPaymentStatuses: Array<'Unpaid' | 'Partially Paid' | 'Paid'>;
  // 4. Check-in / Check-out Condition
  requireCheckIn: boolean;
  requireCheckOutForFinal: boolean;
  // 5. Minimum Amount Condition
  minimumAmountEnabled: boolean;
  minimumInvoiceAmount: number;
  // 6. Automatic / Manual Invoice Generation
  generationMode: InvoiceGenerationMode;
  autoGenerateOnCheckout: boolean;
  // 7. Duplicate Invoice Prevention
  preventDuplicateFinalInvoice: boolean;
  // 8. Tax Calculation Condition
  applyTax: boolean;
  defaultGstRate: number;
  splitCgstSgst: boolean;
  taxOnRoom: boolean;
  taxOnExtraBed: boolean;
  taxOnFood: boolean;
  taxOnAncillary: boolean;
}

export interface HotelSettings {
  id?: string;
  logoUrl: string;
  name: string;
  address: string;
  gstNumber: string;
  phoneNumber: string;
  emailAddress: string;
  website: string;
  checkInTime?: string;
  checkOutTime?: string;
  earlyCheckInEnabled?: boolean;
  earlyCheckInType?: 'hourly' | 'fixed';
  earlyCheckInHourlyRate?: number;
  earlyCheckInFixedRate?: number;
  timeZone?: string;
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | string;
  businessDate?: string;
  lastNightAuditAt?: string;
  invoicePrefix?: string;
  nextInvoiceSequence?: number;
  isGstEnabled?: boolean;
  defaultGstRate?: number;
  foodGstRate?: number;
  roomRateIncludesGst?: boolean;
  taxOnAncillary?: boolean;
  waterBottleRate?: number;
  grcPrefix?: string;
  nextGrcSequence?: number;
  grcTerms?: string[];
  placeOfSupply?: string;
  gstSlabs?: number[];
  invoiceConditions?: InvoiceConditionsConfig;
  panNumber?: string;
}

export interface Testimonial {
  id: string;
  authorName: string;
  hotelName: string;
  content: string;
  rating: number;
}

export interface CustomPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  linkText?: string;
  published: boolean;
  createdAt?: string;
}

export interface WebsiteHeroPillar {
  id: string;
  title: string;
  subtitle: string;
}

export interface WebsiteFeatureCard {
  id: string;
  title: string;
  description: string;
  bullets: string[];
}

export interface WebsitePricingCard {
  id: string;
  planKey: 'Trial' | 'Monthly' | 'HalfYearly' | 'Yearly';
  title: string;
  description: string;
  priceText: string;
  periodText: string;
  gstText: string;
  features: string[];
  buttonText: string;
  badgeText?: string;
  isHighlighted?: boolean;
  isPopular?: boolean;
}

export interface WebsiteVisionPillar {
  id: string;
  title: string;
  description: string;
}

export interface WebsiteCustomSectionItem {
  id: string;
  title: string;
  description: string;
  badge?: string;
  badgeText?: string;
  bullets?: string[];
}

export interface WebsiteCustomSection {
  id: string;
  heading: string;
  subtitle: string;
  items: WebsiteCustomSectionItem[];
}

export interface WebsiteBlogPost {
  id: string;
  title: string;
  slug?: string;
  category: string;
  author?: string;
  publishedAt: string;
  readTime?: string;
  imageUrl?: string;
  summary: string;
  content: string;
  published: boolean;
}

export interface SystemWebsiteConfig {
  businessName: string;
  brandTagline?: string;
  supportPhone: string;
  whatsappNumber?: string;
  whatsappDefaultMessage?: string;
  supportEmail: string;
  hasWhatsapp: boolean;
  logoUrl: string;
  navSignInText?: string;
  navOnboardText?: string;
  // Hero Section
  heroBadgeText?: string;
  heroTitle: string;
  heroTitleLine1?: string;
  heroTitleLine2?: string;
  heroTitleLine3?: string;
  heroSubtitle: string;
  heroBgImageUrl?: string;
  heroPrimaryCtaText?: string;
  heroSecondaryCtaText?: string;
  heroTrustBadges?: string[];
  heroBottomPillars?: WebsiteHeroPillar[];
  // Features Section
  featuresHeading?: string;
  featuresSubtitle?: string;
  featureCards?: WebsiteFeatureCard[];
  // Pricing Section
  pricingHeading?: string;
  pricingSubtitle?: string;
  pricingCards?: WebsitePricingCard[];
  // Vision Section
  visionTitle: string;
  visionContent: string;
  visionPillars?: WebsiteVisionPillar[];
  // Testimonials Section
  testimonialsHeading?: string;
  testimonialsSubtitle?: string;
  testimonials: Testimonial[];
  // Blog Section
  blogHeading?: string;
  blogSubtitle?: string;
  blogs?: WebsiteBlogPost[];
  // Contact Section
  contactHeading?: string;
  contactSubtitle?: string;
  contactEmailTitle?: string;
  contactEmailSubtitle?: string;
  contactPhoneTitle?: string;
  contactPhoneSubtitle?: string;
  contactAddressTitle?: string;
  contactAddressSubtitle?: string;
  contactAddress: string;
  // Footer Section
  footerTagline?: string;
  footerDescription?: string;
  footerPlatformTitle?: string;
  footerEnterpriseTitle?: string;
  footerDirectDeskTitle?: string;
  footerCopyrightText?: string;
  footerGstDisclaimer?: string;
  // Custom Dynamic Sections
  customSections?: WebsiteCustomSection[];
}

export interface ExtraCharge {
  id: string;
  category?: 'Laundry' | 'Food' | 'Damage' | 'Late Checkout' | 'Other' | 'Water Bottle' | 'Extra' | 'Upgrade' | string;
  description: string;
  amount: number;
  dateTime?: string;
  date?: string;
  addedBy?: string;
  sourceType?: 'pos_order' | 'water_bottle' | 'laundry_order' | 'guest_service' | 'manual';
  sourceId?: string;
  requestId?: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank' | string;
  paymentType: 'Advance Deposit' | 'Partial Payment' | 'Settle Balance' | 'Extra Payment' | 'Deposit Balance Payment';
  dateTime: string;
  date?: string;
  referenceNo?: string;
  notes?: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  hotelId?: string;
}

export interface InventorySupplier {
  id: string;
  name: string;
  mobile: string;
  gst: string;
  address: string;
  hotelId?: string;
}

export interface InventoryProduct {
  id: string;
  name: string;
  code: string;
  sku?: string;
  category: string;
  unit: string;
  purchasePrice: number;
  currentStock: number;
  minimumStock: number;
  minStockAlert?: number;
  minStock?: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  lastUpdated?: string;
  hotelId?: string;
}

export interface InventoryPurchaseItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InventoryPurchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  dueDate?: string;
  items: InventoryPurchaseItem[];
  grandTotal: number;
  taxRate?: number;
  taxAmount?: number;
  amountPaid?: number;
  outstandingAmount?: number;
  paymentStatus?: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Pending' | 'Partial';
  paymentMethod?: string;
  paidDate?: string;
  paidBy?: string;
  paymentReference?: string;
  notes?: string;
  status: 'Completed' | 'Pending';
  hotelId?: string;
  isDemoData?: boolean;
}

export interface InventoryStockMovement {
  id: string;
  type: 'IN' | 'OUT';
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  date: string;
  reason?: string;
  supplierId?: string;
  refNumber?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  hotelId?: string;
  time?: string;
  previousStock?: number;
  newStock?: number;
  performedBy?: string;
}

export interface PosItemVariant {
  id: string;
  name: string;
  price: number;
}

export interface PosItemAddon {
  id: string;
  name: string;
  price: number;
}

export interface PosItem {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  taxRate: number; // percentage e.g. 5 for 5% GST
  inventoryProductId?: string; // link to inventory product for automatic stock deduction
  available: boolean;
  image?: string;
  variants?: PosItemVariant[];
  addons?: PosItemAddon[];
  modifiers?: string[]; // e.g. ["Less Spicy", "Extra Hot", "No Onion", "Jain"]
  isCombo?: boolean;
  comboItems?: string[]; // names of items in combo
  kitchenStation?: string; // e.g. "Main Kitchen", "Bar", "Bakery", "Tandoor"
  hotelId?: string;
}

export interface PosOrderItem {
  itemId: string;
  itemName: string;
  itemCode: string;
  price: number;
  /** Original fixed menu catalog price at the time of order / KOT creation (for Night Audit deviation tracking). */
  menuPrice?: number;
  taxRate: number;
  quantity: number;
  total: number;
  selectedVariant?: string;
  selectedAddons?: string[];
  selectedModifiers?: string[];
  itemNotes?: string;
}

export interface PosTable {
  id: string;
  tableNumber: string;
  floor: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Cleaning';
  currentOrderId?: string;
  assignedWaiter?: string;
  hotelId?: string;
}

export interface PosCategory {
  id: string;
  name: string;
  description?: string;
  hotelId?: string;
}

export interface PosCoupon {
  id: string;
  code: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  minOrderValue: number;
  active: boolean;
  hotelId?: string;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  orderType: 'Dine In' | 'Room Service' | 'Takeaway' | 'Delivery' | 'Room Charge' | 'Walk In';
  tableNo?: string;
  floor?: string;
  roomNumber?: string;
  checkInId?: string;
  checkinId?: string;
  folioChargeId?: string;
  linkedInvoiceId?: string;
  guestName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  waiterName?: string;
  items: PosOrderItem[];
  subtotal: number;
  taxAmount: number;
  cgst?: number;
  sgst?: number;
  discount: number;
  couponCode?: string;
  couponDiscount?: number;
  grandTotal: number;
  paymentMethod: 'Cash' | 'Card' | 'UPI' | 'Credit' | 'Room Charge';
  paymentStatus: 'Paid' | 'Unpaid';
  status: 'Completed' | 'Pending' | 'Cancelled' | 'Saved' | 'KOT Sent' | 'Settled' | 'Closed' | 'Held';
  date: string;
  time: string;
  hotelId?: string;
  isDemoData?: boolean;

  // POS Workflow & Kitchen Lifecycle
  isSaved?: boolean;
  isHeld?: boolean;
  heldAt?: string;
  holdNote?: string;
  kotSent?: boolean;
  kotSentAt?: string;
  kitchenStatus?: 'Pending' | 'Preparing' | 'Ready' | 'Served';
  kitchenStation?: string;
  isSettled?: boolean;
  settledAt?: string;
  invoiceGenerated?: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  isClosed?: boolean;
  inventoryUpdated?: boolean;
  notes?: string;
  isWithoutGst?: boolean;

  // Bill Splitting
  splitDetails?: {
    splitType: 'Equal' | 'By Item';
    splitCount?: number;
    paidSplits?: number;
    splitAmounts?: number[];
  };
}

export interface PettyCashTransaction {
  id: string;
  hotelId?: string;
  date: string;
  type: 'Inflow' | 'Outflow';
  category: string;
  amount: number;
  handler: string;
  notes: string;
  approvedBy?: string;
  sourceType?: string;
  sourceId?: string;
  isDemoData?: boolean;
}

export interface CashBankAccount {
  id: string;
  hotelId?: string;
  accountName: string;
  accountType: 'Cash Drawer' | 'Bank Account' | 'POS Machine / Card' | 'UPI / Digital';
  accountNumber?: string;
  ifsc?: string;
  openingBalance?: number;
  openingBalanceDate?: string;
  currentBalance: number;
  reconciledBalance?: number;
  reconciliationNotes?: string;
  lastReconciled?: string;
  isDemoData?: boolean;
}

export interface CashBankTransfer {
  id: string;
  hotelId?: string;
  date: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  referenceNo?: string;
  notes?: string;
  performedBy: string;
}

export interface FinanceVoucher {
  id: string;
  hotelId?: string;
  voucherNumber: string;
  voucherType: 'Payment Voucher' | 'Receipt Voucher';
  date: string;
  partyName: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Card';
  accountName?: string;
  amount: number;
  taxAmount?: number;
  taxRate?: number;
  narration: string;
  referenceNo?: string;
  category?: string;
  preparedBy: string;
  status: 'Issued' | 'Pending Approval' | 'Cancelled';
  sourceType?: 'expense' | 'invoice' | 'inventory_purchase' | 'vendor_opening' | 'reimbursement' | 'owner_equity' | 'manual_other_income' | 'manual_voucher';
  sourceId?: string;
  idempotencyKey?: string;
  isDemoData?: boolean;
}

export interface Vendor {
  id: string;
  hotelId?: string;
  name: string;
  companyName?: string;
  category: string;
  mobile: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  openingBalance: number;
  status: 'Active' | 'Inactive';
  isDemoData?: boolean;
}

export interface VendorPayment {
  id: string;
  hotelId?: string;
  vendorId: string;
  vendorName: string;
  date: string;
  amount: number;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque';
  accountName?: string;
  voucherNumber?: string;
  referenceNo?: string;
  notes?: string;
}

export interface OwnerDirectorPayment {
  id: string;
  hotelId?: string;
  date: string;
  directorName: string;
  type:
    | 'Capital Injection'
    | 'Capital Introduced'
    | 'Director Loan In'
    | 'Owner Withdrawal'
    | 'Director Salary'
    | 'Director Remuneration'
    | 'Profit Share / Drawing'
    | 'Profit Distribution'
    | 'Loan Repayment'
    | 'Personal Expense Paid by Company'
    | string;
  category?: 'Capital Contribution' | 'Owner Drawing';
  amount: number;
  paymentMethod: 'Bank Transfer' | 'Cheque' | 'Cash' | 'UPI' | 'Card' | string;
  bankAccountName?: string;
  notes: string;
  referenceNo?: string;
  recordedBy?: string;
  createdBy?: string;
  approvedBy?: string;
  status?: 'Completed' | 'Pending Approval' | 'Cancelled';
  idempotencyKey?: string;
  isDemoData?: boolean;
}

export interface StaffReimbursement {
  id: string;
  hotelId?: string;
  date: string;
  staffName: string;
  staffRole?: string;
  expenseTitle: string;
  category: string;
  amount: number;
  paymentMethod?: string;
  receiptAttached: boolean;
  receiptFileName?: string;
  receiptFileData?: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  approvedBy?: string;
  paidDate?: string;
  isDemoData?: boolean;
}

export interface DailyClosingRecord {
  id: string;
  hotelId?: string;
  date: string;
  closedBy: string;
  verifiedBy?: string;
  openingCash: number;
  roomCashCollected: number;
  posCashCollected: number;
  otherCashInflow: number;
  expensesPaidInCash?: number;
  pettyCashOutflow: number;
  cashHandedOver?: number;
  closingCashSystem?: number;
  closingCashActual?: number;
  discrepancy?: number;
  expectedClosingCash?: number;
  physicalCashCounted?: number;
  cashMismatch?: number;
  upiCollected: number;
  cardCollected: number;
  bankTransferCollected: number;
  status: 'Balanced' | 'Discrepancy Logged' | 'Pending Verification' | 'Closed' | 'Discrepancy';
  notes?: string;
}

export interface LaundryItemMaster {
  id: string;
  name: string;
  price: number;
  category: 'Guest Garment' | 'Hotel Linen' | 'Uniform' | 'Other';
  unit: string;
  hotelId?: string;
}

export interface LaundryOrderItem {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface LaundryOrder {
  id: string;
  orderNumber: string;
  hotelId?: string;
  orderType: 'Guest Laundry' | 'Hotel Linen Laundry';
  roomNumber?: string;
  guestName?: string;
  checkInId?: string;
  checkinId?: string;
  folioChargeId?: string;
  items: LaundryOrderItem[];
  totalAmount: number;
  paymentStatus: 'Pending' | 'Billed to Room' | 'Paid' | 'Complimentary';
  deliveryStatus: 'Pending' | 'In Wash' | 'Ironing' | 'Ready for Delivery' | 'Delivered';
  date: string;
  notes?: string;
  handledBy?: string;
  inventoryProductId?: string;
  inventoryQtyUsed?: number;
}

export interface LostAndFoundItem {
  id: string;
  hotelId?: string;
  itemName: string;
  category: 'Electronics' | 'Clothing' | 'Documents/Wallet' | 'Jewelry' | 'Toiletries' | 'Others';
  roomNumber?: string;
  locationFound: string;
  foundByStaff: string;
  dateFound: string;
  status: 'Registered' | 'Claimed' | 'Disposed';
  description?: string;
  imagePath?: string;
  claimedByGuest?: string;
  claimGuestMobile?: string;
  claimDate?: string;
  returnNotes?: string;
}

export interface HousekeepingCleaningLog {
  id: string;
  hotelId?: string;
  roomNumber: string;
  assignedStaff: string;
  assignedAt: string;
  cleanedAt?: string;
  inspectedAt?: string;
  inspectedBy?: string;
  inspectionResult?: 'Pass' | 'Fail' | 'Pending';
  status: 'Assigned' | 'In Progress' | 'Cleaned' | 'Inspected' | 'Pending';
  checklistCompleted: string[];
  notes?: string;
}

export type NotificationEventType =
  | 'registration'
  | 'approval'
  | 'suspension'
  | 'booking'
  | 'checkin'
  | 'checkout'
  | 'payment'
  | 'invoice'
  | 'expense'
  | 'subscription'
  | 'staff'
  | 'security'
  | 'housekeeping'
  | 'system';

export interface AppNotification {
  id: string;
  hotelId: string; // 'SUPERADMIN' for platform-level, or specific hotelId (e.g. 'hotel-1')
  recipientRole: 'SuperAdmin' | 'Admin' | 'Owner' | 'All';
  recipientUser?: string;
  title: string;
  message: string;
  type: NotificationEventType;
  severity: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  linkPath?: string;
  entityId?: string;
  dedupeKey?: string;
  metadata?: Record<string, any>;
}

export interface DeletedItemRecord {
  id: string;
  hotelId?: string;
  itemType: 'Booking' | 'Invoice' | 'Guest' | 'Document' | 'Room' | 'Expense';
  itemId: string;
  title: string;
  guestName?: string;
  roomNumber?: string;
  amount?: number;
  deletedAt: string;
  deletedBy: string;
  reason?: string;
  data: any;
}

export interface TravelAgent {
  id: string;
  hotelId?: string;
  name: string;
  agencyName: string;
  mobile: string;
  email?: string;
  city?: string;
  address?: string;
  gstNumber?: string;
  commissionType: 'percentage' | 'fixed';
  commissionValue: number;
  status: 'Active' | 'Inactive';
  notes?: string;
  createdAt: string;
}

export interface AgentCommissionPayment {
  id: string;
  hotelId?: string;
  agentId: string;
  agentName: string;
  agencyName?: string;
  amount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Cheque' | string;
  referenceNo?: string;
  date: string;
  notes?: string;
  recordedBy?: string;
  bookingIds?: string[];
}

export interface FoodAdvanceBooking {
  id: string;
  bookingNumber: string;
  hotelId?: string;
  bookingDate: string;
  guestOrGroupName: string;
  mobile?: string;
  companyName?: string;
  meals: Array<'Breakfast' | 'Lunch' | 'Dinner'>;
  eventDate: string;
  eventTime?: string;
  pax: number;
  menuCuisine: string;
  mealTypes: Array<'Veg' | 'Non-Veg'>;
  ratePerPax: number;
  focPax: number;
  totalAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank' | 'Voucher' | string;
  status: 'Advance' | 'In Process' | 'Confirmed' | 'Completed' | 'Cancelled';
  specialRequest?: string;
  confirmedBy?: string;
  convertedPosOrderId?: string;
  createdAt: string;
}



