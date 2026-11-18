import {
  AssetGroup,
  RoomAsset,
  RoomBlockRecord,
  PriceHistoryRecord,
  BookingRecord,
  InvoiceRecord,
  HousekeepingTask,
  LaundryOrderRecord,
  LostFoundRecord,
  PosMenuItem,
  PosOrderRecord,
  InventoryItemRecord,
  InventorySupplierRecord,
  InventoryPurchaseRecord,
  StockMovementRecord,
  OtaChannelRecord,
  FinanceExpenseRecord,
  FinanceVoucherRecord,
  CashBankAccountRecord,
  PettyCashRecord,
  OwnerPaymentRecord,
  StaffReimbursementRecord,
  DailyClosingEntry,
  StaffMemberRecord,
  AuditLogEntry,
  NotificationEntry,
  WaterBottleLogEntry,
} from '../types';

// ============================================================================
// ZERO DUMMY DATA — ALL OPERATIONAL ARRAYS ARE EMPTY BY DEFAULT
// ALL DATA IS LOADED FROM & SYNCED DIRECTLY TO THE DATABASE
// ============================================================================

export const SAMPLE_AADHAAR_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360">
  <rect width="600" height="360" rx="18" fill="#FFFDF9" stroke="#C49A3A" stroke-width="3"/>
  <rect x="0" y="0" width="600" height="58" rx="16" fill="#FF9933"/>
  <rect x="0" y="46" width="600" height="16" fill="#FFFFFF"/>
  <rect x="0" y="60" width="600" height="14" fill="#138808"/>
  <text x="300" y="36" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#17120F" text-anchor="middle">GOVERNMENT ID VERIFICATION RECORD</text>
  <rect x="34" y="96" width="130" height="155" rx="10" fill="#E6EBF2" stroke="#94A3B8" stroke-width="2"/>
  <circle cx="99" cy="148" r="28" fill="#64748B"/>
  <path d="M55 230 C55 190 143 190 143 230 Z" fill="#64748B"/>
  <text x="190" y="145" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#17120F">Verified Guest Identity Document</text>
  <text x="190" y="180" font-family="Arial, sans-serif" font-size="13" fill="#0F766E" font-weight="bold">✓ Verified at Front Desk Counter</text>
</svg>
`)}`;

export const INITIAL_HOTEL_PROFILE = {
  id: '',
  name: 'DirectStay Property',
  tagline: '',
  ownerName: '',
  phone: '',
  email: '',
  gstNumber: '',
  gstin: '',
  panNumber: '',
  website: '',
  address: '',
  checkInTime: '12:00 PM',
  checkOutTime: '11:00 AM',
  defaultGstRate: 5,
  foodGstRate: 5,
  invoicePrefix: 'INV-',
  fssai: '',
  bankName: '',
  accountNo: '',
  upiId: '',
};

export const HOTEL_PROFILE = INITIAL_HOTEL_PROFILE;

export const INITIAL_ASSET_GROUPS: AssetGroup[] = [];
export const INITIAL_ROOMS: RoomAsset[] = [];
export const INITIAL_ROOM_BLOCKS: RoomBlockRecord[] = [];
export const INITIAL_PRICE_HISTORY: PriceHistoryRecord[] = [];
export const INITIAL_BOOKINGS: BookingRecord[] = [];
export const INITIAL_INVOICES: InvoiceRecord[] = [];
export const INITIAL_HOUSEKEEPING_TASKS: HousekeepingTask[] = [];
export const INITIAL_LAUNDRY_ORDERS: LaundryOrderRecord[] = [];
export const INITIAL_LOST_FOUND: LostFoundRecord[] = [];
export const INITIAL_POS_MENU: PosMenuItem[] = [];
export const INITIAL_POS_ORDERS: PosOrderRecord[] = [];
export const INITIAL_INVENTORY_ITEMS: InventoryItemRecord[] = [];
export const INITIAL_SUPPLIERS: InventorySupplierRecord[] = [];
export const INITIAL_PURCHASES: InventoryPurchaseRecord[] = [];
export const INITIAL_STOCK_MOVEMENTS: StockMovementRecord[] = [];
export const INITIAL_OTA_CHANNELS: OtaChannelRecord[] = [];
export const INITIAL_EXPENSES: FinanceExpenseRecord[] = [];
export const INITIAL_VOUCHERS: FinanceVoucherRecord[] = [];
export const INITIAL_CASH_BANK_ACCOUNTS: CashBankAccountRecord[] = [];
export const INITIAL_PETTY_CASH: PettyCashRecord[] = [];
export const INITIAL_OWNER_PAYMENTS: OwnerPaymentRecord[] = [];
export const INITIAL_REIMBURSEMENTS: StaffReimbursementRecord[] = [];
export const INITIAL_DAILY_CLOSINGS: DailyClosingEntry[] = [];
export const INITIAL_STAFF: StaffMemberRecord[] = [];
export const INITIAL_WATER_LOGS: WaterBottleLogEntry[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
export const INITIAL_NOTIFICATIONS: NotificationEntry[] = [];
