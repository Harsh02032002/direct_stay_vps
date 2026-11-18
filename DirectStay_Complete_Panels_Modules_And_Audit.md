# DirectStay Hotel PMS SaaS — Complete Panels, Modules, Sub-Modules & System Architecture Guide

Ye single master document poore **DirectStay Hotel Property Management System (SaaS)** ka complete breakdown hai. Isme:
1. **Kul kitne Panels (Portals) hain**
2. **Har Panel ke saare Modules, unke andar ke Sub-Modules (Tabs), aur unke andar kya-kya features/fields hain**
3. **Complete Architecture, Database, Roles, Login Flows, aur Multi-Tenant Security Audit**

---

## PART 1: Total Kitne Panels (Portals) Hain? (Overview of All Panels)

Poore software mei **4 Main Portals / Panels** hain (aur Hotel PMS Panel ke andar Staff Roles ke hisaab se customized views hain):

| # | Panel / Portal Name | Login / Access URL | Main Component File | Kiske Liye Hai? (Target Role) | Total Main Modules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Public Marketing & Onboarding Portal** | `/` (Home) & `/login` | `src/components/FrontWebsite.tsx`, `src/components/LoginView.tsx` | Public Visitors, New Hotel Owners (Self-Registration) | **7 Sections + 2 Modals** |
| **2** | **SuperAdmin SaaS Master Console** | `/superadmin` | `src/components/SuperAdminHub.tsx` | `SuperAdmin` (Platform Owner) | **8 Modules** (6 SaaS Modules + Notifications + Profile) |
| **3** | **Hotel Owner Executive Portal** | `/hotelowner` | `src/components/HotelOwnerView.tsx` | `Owner` (Hotel/Property Owner) | **10 Modules** (8 Executive Sub-Tabs + Notifications + Profile) |
| **4** | **Hotel PMS Operational Desk Panel** | `/admin` (or `/login`) | `src/App.tsx` + 22 Operational Views | `Admin`, `Manager`, `Receptionist`, `Accounts`, `Housekeeping` | **14 Sidebar Parent Modules** (**55+ Sub-Modules/Tabs**) |

---

## PART 2: Har Panel, Uske Modules, Sub-Modules, Aur Unke Andar Kya-Kya Hai

---

### PANEL 1: Public Marketing & Onboarding Portal (`/` & `/login`)
**Files**: `src/components/FrontWebsite.tsx`, `src/components/LoginView.tsx`

1. **Public SaaS Website (`FrontWebsite.tsx`)**:
   - **Hero Banner & Value Pillars**: Headline, subheadline, CTA buttons (*Start Free Trial*, *Login*), 3 Hero Pillars.
   - **Core Features Showcase**: Feature cards (Front Desk, GST Billing, POS, Housekeeping, OTA Sync, Reports).
   - **SaaS Pricing & Packages Section**: Dynamic pricing cards (`SaaSPackage` — Monthly/Yearly toggle, room limits, included modules).
   - **Vision & Architecture Section**: Platform capabilities aur trust badges.
   - **Customer Testimonials**: Hotel owners ke reviews aur ratings.
   - **Custom CMS Pages**: SuperAdmin dwara banaye gaye dynamic pages (e.g., Privacy Policy, Terms, About).
   - **Property Inquiry / Contact Form**: Lead generation form jo SuperAdmin ke notification/inquiry list mei jata hai.
2. **Multi-Portal Login Screen (`LoginView.tsx`)**:
   - **3 Portal Modes**:
     - `/superadmin` → **Super Admin Portal Login**
     - `/hotelowner` → **Hotel Owner Executive Login**
     - `/admin` or `/login` → **Hotel Admin & Staff PMS Login**
   - **Partner Property Self-Registration Modal (`Register Your Hotel`)**:
     - Fields: Hotel Name, Owner Name, Mobile Number, Email Address, City/Address, GST Number, Admin Username, Admin Password, Room Tier selection.
     - Submit hone par `status: 'Pending'` aur `subscriptionStatus: 'Trial'` ke saath naya hotel DB mei save hota hai.

---

### PANEL 2: SuperAdmin SaaS Master Console (`/superadmin`)
**Main File**: `src/components/SuperAdminHub.tsx` | **Sidebar Menu**: `src/components/Sidebar.tsx`

SuperAdmin panel mei **8 Main Sidebar Modules** hain (aur ek **Property Switcher Dropdown** hai jisse SuperAdmin kisi bhi hotel ke PMS ke andar jump kar sakta hai):

#### Module 2.1: SaaS Overview (`subTab: 'dashboard'`)
- **KPI Cards**: Total Registered Hotels, Active Subscriptions, Pending Approvals, Monthly Recurring Revenue (MRR), Annual Run Rate (ARR), Suspended/Expired Tenants.
- **Interactive Charts**: Monthly SaaS Revenue Trend chart, New Tenant Registrations bar chart.
- **Live SaaS Activity Feed**: Filters (`All`, `Registration`, `Approval`, `Renewal`, `Upgrade`, `Suspension`) ke saath recent tenant activities.
- **Pending Approvals Quick Queue**: Jo hotels self-register huye hain unhe 1-click Approve/Reject karne ki list.

#### Module 2.2: Hotel Properties (`subTab: 'hotels'`)
Iske andar saare tenant hotels ki directory aur **4 Sub-Modals** hain:
- **Sub-Feature A: Tenant Directory & Status Filters**:
  - Filters: `All`, `Pending`, `Approved`, `Trial`, `Expiring`, `Expired`, `Active`, `Suspended`.
  - Quick Actions per Hotel: **Approve / Suspend Toggle**, **Access PMS** (hotel ke PMS mei ghusna), **Change Package**, **Edit Profile**, **View Details**, **Delete Hotel**.
- **Sub-Modal B: `+ Add New Hotel` (Direct Tenant Onboarding Modal)**:
  - Fields: Hotel Name, Owner Name, Email, Mobile, Address, Template (`Boutique`, `Luxury`, `Budget`), Package Plan, Room Limit, Admin Username/Password, Owner Username/Password.
  - Default Status: `status: 'Approved'`, `subscriptionStatus: 'Active'` (taki turant login ho sake).
- **Sub-Modal C: `Modify Tenant Property Profile` Modal**:
  - **1. General & Brand Identity**: Hotel Name, Owner Name, Email Address, Mobile Phone, WhatsApp Number, Logo URL, Admin Username, Admin Password, Approval Status (`Approved`, `Pending`, `Suspended`, `Rejected`), Address.
  - **2. Financial, Legal & Localisation**: GST Number, PAN Number, Currency Display, Time Zone, External Payment Link.
  - **3. SMTP & Invoicing Configuration**: SMTP Host, SMTP Port, SMTP Username, SMTP Password, SSL/TLS Checkbox, Invoice Prefix, Room Size Capacity Tier (`1-10`, `10-20`, `20-30`, `30-50`).
- **Sub-Modal D: `Change Package` & Subscription Extension Modal**:
  - Tenant ka SaaS package badalna, billing cycle (`Monthly` / `Yearly`) set karna, aur expiry date update karna.

#### Module 2.3: Packages & Subscriptions (`subTab: 'packages'`)
- **Sub-Module A: SaaS Pricing Plans CRUD**:
  - Create / Edit / Delete SaaS Packages (`Starter`, `Growth`, `Enterprise`, etc.).
  - Package Fields: Plan Name, Tagline, Badge (`Popular`, `Best Value`), Monthly Price, Yearly Price, Max Rooms Allowed (`maxRooms`).
  - **Module Access Toggles (`PackageModulePermissions`)**: Checkbox controls ki is plan mei kaunse modules milenge (`ota`, `staff`, `reports`, `cashHandover`, `expenses`, `invoices`, `policies`, `website`, `pos`, `inventory`).
- **Sub-Module B: Assign Package to Hotels**: Kisi bhi package ko directly hotels par apply karna.
- **Sub-Module C: Subscription Renewal & UTR Verification Queue**:
  - Hotel Owners dwara bheje gaye renewal UTR requests (`owner_payments` / `subscription_requests`) ko verify karke **Approve & Extend (30/180/365 days)** ya **Reject** karna.

#### Module 2.4: User Credentials (`subTab: 'users'`)
- **Sub-Module A: Hotel Admin & Owner Credentials Directory**: Saare hotels ke Admin aur Owner usernames, emails, phones, aur password reset/edit controls.
- **Sub-Module B: Global Staff Accounts Directory**: Har hotel ke staff logins (`Receptionist`, `Manager`, `Accountant`, `Housekeeping`) ko dekhna, hotel se link/unlink karna, ya password reset karna.

#### Module 2.5: Website CMS (`subTab: 'website'`)
Public landing page (`FrontWebsite.tsx`) ko bina code chhede edit karne ka complete CMS:
- **Sub-Tab A: Hero & Branding**: Brand Name, Tagline, Hero Title, Subtitle, CTA Button Text, Hero Pillars.
- **Sub-Tab B: Features & Vision Cards**: Landing page ke feature cards aur vision pillars edit karna.
- **Sub-Tab C: Pricing Display Cards**: Website par dikhne wale pricing cards customize karna.
- **Sub-Tab D: Testimonials Manager**: Client reviews add/edit/delete karna.
- **Sub-Tab E: Custom Dynamic Sections**: Naye sections aur items public website mei jodna.
- **Sub-Tab F: Footer, Contact & Social Links**: Support phone, email, address, copyright text.

#### Module 2.6: Custom Pages (`subTab: 'pages'`)
- Dynamic CMS pages banana (Title, URL Slug, Rich Content, Featured Image Upload, External Link Button, Published/Draft toggle).

#### Module 2.7 & 2.8: System Notifications (`notifications`) & Profile Settings (`profile`)
- Global SaaS alerts (New hotel registrations, subscription renewal UTR submissions) aur SuperAdmin profile settings.

---

### PANEL 3: Hotel Owner Executive Portal (`/hotelowner`)
**Main File**: `src/components/HotelOwnerView.tsx` | **Sidebar Menu**: `src/components/Sidebar.tsx`

Hotel Owner ke liye **8 Dedicated Executive Modules (Sub-Tabs)** + Notifications + Profile hain:

| # | Sub-Module Name (`HotelOwnerSubTab`) | Iske Andar Kya-Kya Hai? (Features & Controls) |
| :--- | :--- | :--- |
| **3.1** | **Overview (`dashboard`)** | Executive KPI Cards (Total Revenue, Net Profit & Margin %, Live Occupancy %, Active Rooms, Pending Receivables, Pending Expense Approvals), Revenue Mix (Room Invoices vs POS Food), Booking Channel Mix (Direct Walk-in vs OTA), Recent Bookings & Recent Audit Alerts. |
| **3.2** | **Property Details (`property`)** | Hotel Owner khud apne hotel ki profile edit kar sakta hai: Property Name, Owner Name, Phone, Email, GSTIN, PAN Number, Website, Full Address, Check-In Time, Check-Out Time (saved directly to MongoDB Atlas). |
| **3.3** | **Bookings (`bookings`)** | Property ki saari bookings ka executive search aur status filter (`All`, `Confirmed`, `CheckedIn`, `CheckedOut`, `Cancelled`) ke saath read-only register (Guest Name, Room, Dates, Source, Advance, Total Amount). |
| **3.4** | **Revenue & Expenses (`financials`)** | **1. Pending Expense Approvals Queue**: Staff/Admin dwara daale gaye expenses ko **Approve** ya **Reject** karne ke buttons.<br/>**2. Owner / Director Ledger (`OwnerDirectorPayment`)**: `+ Record Drawing / Capital` modal jisse Owner apna Profit Share / Drawing, Capital Injection, Director Salary, ya Loan Repayment record kar sakta hai.<br/>**3. Full Expense Register**: Approved/Rejected/Unpaid expenses ki list. |
| **3.5** | **Financial Reports (`occupancy`)** | Room Category Performance breakdown (Standard, Deluxe, Suite occupancy & average rate), Average Daily Rate (ADR), RevPAR calculation, Invoices summary, aur POS sales summary. |
| **3.6** | **Staff Overview (`staff`)** | Property ke saare employees ki list, unka department, designation, contact number, status (`Active`/`On Leave`), aur role overview. |
| **3.7** | **Subscription & Billing (`subscription`)** | Active SaaS Plan details, Room Capacity usage bar (`rooms.length / maxRooms`), Subscription Status & Expiry Date, aur **Self-Service Renewal Cards** (`Monthly ₹1,899`, `Half-Yearly ₹7,999`, `Yearly ₹14,000` + 18% GST) jahan Owner apna UTR number daal kar `/api/subscriptions/renew-request` submit karta hai, plus past renewal payment history table. |
| **3.8** | **Security Audit Logs (`auditLogs`)** | Hotel ke andar har staff aur admin ne kab kya action liya (Check-in, Checkout, Invoice edit, Expense approval, POS order) uska timestamped security log. |
| **3.9** | **Notifications & Profile (`notifications`, `profile`)** | Real-time bell notifications drawer aur Owner profile view. |

---

### PANEL 4: Hotel PMS Operational Desk Panel (`/admin`)
**Main Orchestrator**: `src/App.tsx` | **Sidebar Menu**: `src/components/Sidebar.tsx`

Ye hotel ke rozana kaam-kaaj (Front Desk, Billing, Restaurant POS, Housekeeping, Store Inventory, Accounting, Staff) ka main panel hai. Isme **14 Sidebar Parent Modules** hain aur unke andar **55+ Sub-Modules** hain:

---

#### Module 4.1: PMS Overview (`activeTab: 'dashboard'`)
**File**: `src/components/DashboardView.tsx`
- **Live Operational Cards**: Today's Arrivals, Today's Departures, In-House Guests, Available vs Occupied vs Dirty Rooms, Today's Cash/UPI/Card Collection, Pending Guest Dues.
- **Interactive Room Status Grid**: Har room ka live badge (`Available`, `Occupied`, `Reserved`, `Dirty`, `Maintenance`) aur quick click action.
- **Quick Action Shortcuts**: New Reservation, Walk-in Check-In, Generate Invoice, Record Expense.

---

#### Module 4.2: Front Desk Hub (`activeTab: 'frontDesk'`) — *11 Sub-Modules*
**File**: `src/components/FrontDeskView.tsx` (plus embedded child components)

1. **`dashboard` (Front Desk Dashboard)**: Live Reception Counter console, Today's Check-ins/Check-outs queue, Room availability summary, Quick Water Bottle / Room Service logger.
2. **`reservations` (Advance Reservations — `ReservationView.tsx`)**:
   - New Booking Form (Guest Name, Phone, Email, Check-in/Check-out dates, Room Category & Room Number selection, Booking Source: Walk-in / MakeMyTrip / Booking.com / Goibibo / Corporate, Meal Plan: EP/CP/MAP/AP, Tariff, Advance Payment, GST toggle).
   - **Booking Calendar Sub-Toggle (`CalendarBookingView.tsx`)**: Date-by-date visual tape chart / availability calendar.
3. **`walkin` (Walk-in Booking & Today's Arrivals — `TodayBookingsView.tsx`)**:
   - Instant walk-in guest registration aur aaj ki arrivals list se 1-click `"Proceed to Check-In"`.
4. **`checkin` (Guest Check-In & GRC Form — `CheckInFormView.tsx`)**:
   - Complete Guest Registration Card (GRC): Guest details, Accompanying guests/adults/children, ID Proof Type (`Aadhaar`, `Passport`, `Driving License`, `Voter ID`), ID Number, **Front & Back ID Document Upload / Camera Capture**, Guest Signature/Photo, Company Name & GSTIN, Room Rate, Extra Bed charges, Advance Received.
   - Printable GRC Form.
5. **`inhouse` (In-House Guests Directory)**:
   - Abhi hotel mei ruke huye saare guests ki live list, unka room number, running bill/folio, pending balance, GRC view button, aur extra service charge add karne ka option.
6. **`checkout` (Guest Check-Out & Settlement Console)**:
   - Active occupied rooms ki checkout list, stay duration & tariff calculation, POS food/laundry charges integration, pending balance settlement, aur `"Complete Check-Out & Generate Invoice"` action (jo room ko automatically Housekeeping ke liye `'Dirty'` mark karta hai).
7. **`billing` (Front Desk Invoices & Billing — `InvoiceView.tsx`)**:
   - GST Tax Invoice generator & viewer (CGST + SGST / IGST split, HSN/SAC 996311, Room charges, Extra bed, Food/POS charges, Discount, Split Payment Modes, Print/Download A4 & Thermal Receipt).
8. **`services` (Guest Services & Water Bottle Logs)**:
   - Mineral Water Bottle issue tracker (Complimentary vs Chargeable bottles per room) aur guest service requests log.
9. **`documents` (Guest ID & Document Archive)**:
   - Saare guests ke uploaded ID proofs (Aadhaar/Passport) aur GRC documents ka searchable archive with preview modal.
10. **`reports` (Front Desk Operational & Daily Reports)**:
    - Toggle between **Operational Reports (`ReportsView.tsx`)** and **Daily Shifting / Night Audit Report (`DailyReportView.tsx`)**.
11. **`settings` (Hotel Policies & Rules — `PolicyManager.tsx`)**:
    - Check-in/Check-out policies, Cancellation rules, Child/Extra bed rules, ID verification rules jo invoice aur GRC ke niche print hote hain.

---

#### Module 4.3: Invoice System (`activeTab: 'invoice'`)
**File**: `src/components/InvoiceView.tsx`
- **Sub-Features**:
  - Create / Edit / Settle Guest Tax Invoices.
  - B2B Customer GSTIN & Legal Company Name billing.
  - Itemized Folio: Room Rent, Extra Person/Bed, F&B / POS Room Service, Laundry, Early Check-in / Late Check-out fees, Discounts.
  - Multi-payment history tracker (`PaymentRecord[]`: Cash, UPI, Card, Bank Transfer).
  - Print / PDF Export (A4 Luxury Tax Invoice format).

---

#### Module 4.4: Room Management (`activeTab: 'rooms'`)
**File**: `src/components/RoomManagementView.tsx`
- **Sub-Features**:
  - **Room Inventory CRUD**: Add / Edit / Delete Rooms (Room Number, Floor, Category: `Standard`, `Deluxe`, `Super Deluxe`, `Suite`, `Executive`, Base Tariff Rate, Status: `Available`, `Occupied`, `Cleaning`, `Maintenance`).
  - **SaaS Package Room Limit Guard**: Package ke `maxRooms` limit ke hisaab se room capacity indicator.
  - **Room Verification & Inspection Queue**: Housekeeping ke baad room readiness verify karna.

---

#### Module 4.5: Housekeeping & Laundry (`activeTab: 'housekeeping'`) — *6 Sub-Modules*
**File**: `src/components/HousekeepingView.tsx`

1. **`dashboard` (Housekeeping Overview)**: Dirty, Clean, Inspecting, aur Out of Order rooms ke live counters, active staff assignments, aur pending laundry tasks.
2. **`room_cleaning` (Room Cleaning & Supervisor Inspection)**:
   - Room status filter (`ALL`, `Dirty`, `Clean`, `Inspecting`, `Out of Order`).
   - **5-Point Cleaning Checklist Modal**: (`Linens Changed`, `Bathroom Disinfected`, `Dusting & Vacuuming`, `Restocked Amenities`, `Mini Bar & Water checked`) + Staff assignment.
   - **Supervisor Inspection Modal**: Pass / Fail verification before marking room `'Available'`.
3. **`laundry` (Guest & Hotel Linen Laundry)**:
   - **Sub-Tab A (`orders`)**: Guest Laundry (billed to room folio or paid) & Hotel Linen Laundry orders tracker (`Pending` → `In Wash` → `Ironing` → `Ready for Delivery` → `Delivered`).
   - **Sub-Tab B (`master`)**: Laundry Item Rate Card Master (Shirt, Trouser, Saree, Bed Sheet, Towel washing/dry-cleaning/ironing rates).
4. **`lost_found` (Lost & Found Register)**:
   - Guest ke chhoote huye samaan ki entry (Item Description, Found in Room/Area, Found By Staff, Date, Status: `Stored`, `Returned to Guest`, `Disposed`, Claimed By details).
5. **`reports` (Housekeeping Analytics)**:
   - Staff-wise cleaning turnaround time, daily cleaned rooms log (`HousekeepingCleaningLog`), aur laundry revenue report.
6. **`settings` (Housekeeping Configuration)**:
   - Auto-dirty on checkout toggle, default cleaning checklist customization.

---

#### Module 4.6: POS Terminal & Food (`activeTab: 'pos'`) — *7 Sub-Modules*
**Files**: `src/components/PosView.tsx` + `src/components/pos/*`

1. **`dashboard` (`PosDashboard.tsx`)**: Restaurant F&B daily sales, active KOTs, occupied tables, top-selling dishes.
2. **`terminal` (Live Billing & KOT Terminal in `PosView.tsx`)**:
   - **6 Order Types**: `Dine In`, `Room Service`, `Takeaway`, `Delivery`, `Room Charge`, `Walk In`.
   - **Guest / Customer Identification Panel**: Har order type ke liye **Guest/Customer Name**, **Mobile Number**, aur **Link to Checked-in Room dropdown** (jo select karte hi guest ka naam aur mobile auto-fill kar deta hai), plus Table selector (`Dine In`) aur Delivery Address (`Delivery`).
   - **Cart & Modifiers**: Variants (Half/Full), Add-ons, Spice/Cooking notes, Hold/Resume Order, Coupon/Discount application, GST calculation, Split Bill (`PosSplitBillModal.tsx`), Send KOT to Kitchen, Settle Bill / Post to Room Folio.
3. **`tables` (`PosTableManager.tsx`)**:
   - Floor/Zone wise restaurant tables (`Main Hall`, `Rooftop`, `Poolside`, `Garden`), table capacity, live status (`Available`, `Occupied`, `Reserved`, `Billed`), running order amount, aur table transfer/merge.
4. **`kds` (Kitchen Display System — `PosKdsView.tsx`)**:
   - Chef/Kitchen screen: Live KOT cards with elapsed timer, Guest Name & Room/Table badge, item-level preparation checkboxes, aur status transitions (`KOT Sent` → `Preparing` → `Ready` → `Served`), plus KOT Thermal Print.
5. **`orders` (POS Order Register & Receipts)**:
   - Saare past aur active F&B orders ki list, payment settlement, thermal bill reprint (`PosReceiptModal.tsx`), aur order cancellation.
6. **`catalog` (Menu & Recipe Catalog — `PosCatalogManager.tsx`)**:
   - Menu Items CRUD (Veg/Non-Veg flag, Category, Price, Tax %, Variants, Add-ons, Availability toggle, Inventory stock link), Categories manager, aur Discount Coupons manager.
7. **`reports` (`PosReportsView.tsx`)**:
   - Item-wise sales, Category-wise revenue, Order-type breakdown (Dine-in vs Room Service vs Takeaway), Payment mode summary.

---

#### Module 4.7: Inventory Store (`activeTab: 'inventory'`) — *7 Sub-Modules*
**File**: `src/components/InventoryView.tsx`

1. **`products` (Products Master)**: Store items (`PRD-1001` etc.), current stock, minimum alert stock level, unit (`Pcs`, `Kg`, `Ltr`, `Box`), unit price, aur auto status badge (`In Stock`, `Low Stock`, `Out of Stock`).
2. **`categories` (Inventory Categories)**: Categories CRUD (e.g., *Housekeeping & Cleaning*, *Kitchen & F&B Groceries*, *Guest Toiletries & Amenities*, *Linen & Bedding*).
3. **`suppliers` (Supplier / Vendor Directory)**: Supplier Name, Contact Person, Phone, Email, GSTIN, Address, Category.
4. **`purchases` (Purchase Orders & GRN)**: Purchase Order (`PUR-2026-001`) banana, multi-item purchase entry, supplier invoice reference, payment status (`Paid`, `Pending`, `Partial`), aur stock auto-increment when status is `Received`.
5. **`stockIn` (Manual Stock Inward Log)**: Direct stock additions/adjustments with reason & handler name.
6. **`stockOut` (Stock Issue / Consumption Log)**: Department-wise stock issue (Kitchen, Housekeeping, Front Desk को सामान जारी करना) jo live stock ghata deta hai.
7. **`reports` (Inventory Valuation & Low-Stock Alerts)**: Total stock value, low-stock reorder list, aur complete stock movement ledger (`InventoryStockMovement`).

---

#### Module 4.8: OTA Channel Manager (`activeTab: 'otaManager'`) — *6 Sub-Modules*
**File**: `src/components/OtaManagerView.tsx`

1. **`dashboard` (Channel Manager Overview)**: Connected OTAs count (15 supported providers: Booking.com, MakeMyTrip, Goibibo, Expedia, Agoda, Airbnb, OYO, etc.), OTA booking share, sync health.
2. **`wizard` (OTA Connection Setup Wizard)**: Step-by-step API credential setup (`API Key + Hotel ID`, `OAuth 2.0`, `Bearer Token`), Room Category mapping, aur Rate Plan mapping.
3. **`connections` (Active Channels & Instant Inventory Push)**: Connected channels ki list, sync frequency setting, aur `"Push Rates & Availability Now"` trigger.
4. **`webhooks` (Incoming OTA Booking Webhooks Simulator & Feed)**: OTA se aane wali new bookings/cancellations ka webhook log aur PMS booking sync.
5. **`logs` (API Request/Response Inspector)**: Outgoing/incoming JSON payloads, HTTP status codes, latency, aur retry queue.
6. **`admin` (Channel Rate Parity & Markup Rules)**: OTA-specific markup % ya stop-sell restrictions.

---

#### Module 4.9: Finance Hub (`activeTab: 'finance'`) — *11 Sub-Modules*
**File**: `src/components/FinanceView.tsx`

1. **`dashboard` (Finance Master Overview)**: Total Inflow (Rooms + POS + Vouchers), Total Outflow (Expenses + Petty Cash + Vendor Payments), Net Cashflow, Cash-in-Hand vs Bank Balance cards, P&L summary.
2. **`income` (Unified Income Ledger)**: Room Invoices, Advance Bookings, POS Restaurant Bills, aur Receipt Vouchers ka consolidated date/payment-mode wise register.
3. **`expenses` (Operational Expense Manager)**:
   - Add / Edit Expenses (Category: *Staff Salary*, *Electricity/Utilities*, *Kitchen Supplies*, *Maintenance*, *Marketing*, Vendor selection, Bill upload, GST input credit, Payment mode).
   - Approval status badge (`Pending`, `Approved`, `Rejected`) aur Recurring Expense schedules.
4. **`petty_cash` (Front Desk Petty Cash Book)**:
   - Daily small cash inflows/outflows (`PettyCashTransaction`), opening/closing petty cash balance, handler tracking.
5. **`cash_bank` (Cash Drawers & Bank Accounts Ledger)**:
   - Multiple accounts (`Main Front Desk Cash Drawer`, `HDFC Bank Operating Account`, `ICICI POS Settlement Account`) ka live balance aur **Contra Fund Transfer** (Cash-to-Bank deposit ya Bank-to-Cash withdrawal).
6. **`vouchers` → `vouchers_payment` (Payment Vouchers)**: Party/Vendor ko kiye gaye payments ka formal printable Payment Voucher (`PV-...`).
7. **`vouchers` → `vouchers_receipt` (Receipt Vouchers)**: Miscellaneous/Corporate receipts ka printable Receipt Voucher (`RV-...`).
8. **`vendors` (Vendor Accounts & Payables)**: Vendor master, opening balance, total billed vs paid, pending payable ledger.
9. **`owner_payments` (Owner / Director Drawings & Capital Ledger)**: Managing Director / Hotel Owner ke Capital Injections, Profit Drawings, Director Salary, aur Loan Repayments.
10. **`reimbursements` (Staff Expense Reimbursements)**: Staff ne jo apni jeb se hotel ke kaam ke liye kharch kiya uska claim (`Pending` → `Approved` → `Paid`).
11. **`daily_closing` (Night Audit / Daily Cash Closing Register)**:
    - Din ke ant mei System Calculated Cash vs Physical Counted Cash match karna, discrepancy/shortage note karna, aur Day Book lock karna (`DailyClosingRecord`).

---

#### Module 4.10: Audits & Reports (`activeTab: 'reports'`) — *8 Sub-Modules*
**File**: `src/components/ReportsView.tsx`
*(Includes flexible Date Range Engine: Today, Yesterday, This Week, This Month, Custom Date Range, plus individual date inclusion/exclusion pills)*

1. **`cashReport` (Daily Cash & Payment Mode Collection Report)**: Cash, UPI, Card, aur Bank Transfer collections minus cash expenses = Net Handover Cash.
2. **`nightAudit` (Night Audit & Room Tariff Reconciliation)**: Har room ka aaj ka status, check-in guest, tariff, POS add-ons, aur tax verification.
3. **`pendingReport` (Pending Receivables & Guest Dues Tracker)**: Jin in-house ya checked-out guests ka paisa baki hai unki list + **1-Click WhatsApp/SMS Payment Reminder Message Generator**.
4. **`otaReport` (OTA Source & Commission Analysis)**: Booking source wise (Walk-in vs MMT vs Booking.com vs Agoda) bookings count aur revenue share.
5. **`gstReport` (Monthly GST Tax Filing Report — GSTR-1 / SAC 996311)**: Month-wise taxable value, CGST, SGST, IGST breakup, B2B GSTIN invoices vs B2C invoices, CSV/Print export.
6. **`revenueReport` (Comprehensive P&L & Revenue Analytics)**: Room revenue + Extra charges + Water + POS vs Expenses = Net Operating Profit.
7. **`sarai` (Police Station / Sarai Act Guest Register)**: Government/Police verification format mei saare checked-in guests ka naam, father/husband name, address, mobile, ID proof type & number, nationality, coming from / going to, check-in/out timestamp.
8. **`waterLogs` (Mineral Water Bottle Consumption Audit)**: Room-wise complimentary vs chargeable water bottles log.

---

#### Module 4.11: Staff Workspace (`activeTab: 'staff'`) — *3 Sub-Modules*
**File**: `src/components/StaffManagementView.tsx`

1. **`staff` (Employee Directory & Login Credentials)**:
   - Add / Edit / Delete Staff (Name, Mobile, Address, Department: `Reception`, `Housekeeping`, `Kitchen`, `Management`, `Security`, `Accounts`, Designation, System Role, Login Username & Password, Active/On-Leave status).
2. **`inventory` (Staff Housekeeping & Pantry Supplies Quick Tracker)**:
   - Daily consumable supplies stock (`Mineral Water`, `Soaps`, `Shampoo`, `Bed Sheets`, `Tea/Coffee Pouches`, `Towels`) issue/replenish counter.
3. **`permissions` (Role-Based Access Control Matrix — `RolePermission`)**:
   - Har role (`Manager`, `Receptionist`, `Cashier`, `Accountant`, `Housekeeping`, `Kitchen`, `Security`, `Maintenance`, ya Custom Role) ke liye **8 Granular Permission Switches**:
     - `canManageBookings`, `canManageRooms`, `canManageStaff`, `canManageExpenses`, `canManageHandovers`, `canViewReports`, `canManageOta`, `canManagePolicies`.

---

#### Module 4.12: Owner Audit Logs (`activeTab: 'auditLogs'`)
**File**: `src/components/AuditLogsView.tsx`
- Tamper-evident chronological trail of all user actions inside the hotel (`Action`, `Details`, `Performed By User & Role`, `Timestamp`), filterable by keyword and action type.

---

#### Module 4.13: Notifications Center (`activeTab: 'notifications'`)
**File**: `src/components/NotificationBellAndDrawer.tsx` & Full-Page View in `src/App.tsx`
- **Top Bar Bell Drawer + Full Page Center**:
  - Real-time Server-Sent Events (SSE `/api/notifications/stream`) + MongoDB persistence.
  - Event types: New Booking, Check-In, Check-Out, Payment Received, Housekeeping Alert, Low Stock, Expense Approval Request, Subscription Expiry/Renewal.
  - Filter by `All` / `Unread`, Mark individual or all as read, aur deep-link action button (`View Module`).

---

#### Module 4.14: My Profile & Hotel Branding Settings (`activeTab: 'profile'`)
**File**: `src/components/ProfileSettingsView.tsx`
- **Sub-Section A: Hotel Branding & Invoice Settings**: Hotel Name, Tagline, Logo Upload, Address, Phone, Email, GSTIN, Default GST %, Invoice Prefix, Bank Account Details & UPI QR Code for Invoices, Check-in/Check-out Standard Times.
- **Sub-Section B: Personal Account Security**: Logged-in user ka display name, username, aur password change form.

---

## PART 3: Role-Wise Module Access Summary (Kis Role Ko Kya Dikhta Hai?)

`src/components/Sidebar.tsx` ke mutabik har role ko niche diye gaye modules milte hain:

| Role | Portal URL | Accessible Modules in Sidebar |
| :--- | :--- | :--- |
| **`SuperAdmin`** | `/superadmin` | SaaS Overview, Hotel Properties, Packages & Subscriptions, User Credentials, Website CMS, Custom Pages, Notifications, Profile Settings + **All Hotels Switcher** |
| **`Owner` (Hotel Owner)** | `/hotelowner` | Executive Overview, Property Details, Bookings, Revenue & Expenses (Approvals + Drawings), Financial Reports, Staff Overview, Subscription & Billing, Security Audit Logs, Notifications, Profile Settings |
| **`Admin` & `Manager`** | `/admin` | **All 14 PMS Modules** (PMS Overview, Front Desk [all 11 sub-tabs], Invoice System, Room Management, Housekeeping & Laundry, POS Terminal & Food, Inventory Store, OTA Channel Manager, Finance Hub [all 11 sub-tabs], Audits & Reports, Staff Workspace, Owner Audit Logs, Notifications, Profile Settings) *(Subject to active SaaS Package module flags)* |
| **`Reception` / `Receptionist`** | `/admin` | Front Desk (all 11 sub-tabs), Invoice System, Housekeeping & Laundry, Room Management, POS Terminal & Food, Inventory Store, Finance Hub, Staff Workspace, OTA Channel Manager, Notifications, Profile Settings |
| **`Accounts`** | `/admin` | PMS Overview, Front Desk, Invoice System, Housekeeping & Laundry, Room Management, POS Terminal & Food, Inventory Store, Finance Hub, Audits & Reports, OTA Channel Manager, Notifications, Profile Settings |
| **`Housekeeping`** | `/admin` | Front Desk, Housekeeping & Laundry, Room Management, POS Terminal & Food, Inventory Store, Notifications, Profile Settings |

---

## PART 4: Complete System Architecture & Security Audit Reference

### 4.1 Tech Stack & Persistence Flow
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4. Entry: `index.html` → `src/main.tsx` → `src/App.tsx`.
- **Backend**:
  - Primary Node.js/Express Server: `server.ts` (bundles to `dist/server.cjs`).
  - Shared-Hosting PHP Fallback Gateway: `public/api/index.php`.
- **Database (MongoDB Atlas — `hotel` database)**:
  - Master state document `_id: "FULL_PMS_BACKUP"` in collection `pms_app_state`, fetched via `GET /api/db/state` and synced via `POST /api/db/sync`.
  - Automatically mirrored into 29 individual domain collections (`hotels`, `packages`, `rooms`, `bookings`, `checkins`, `invoices`, `expenses`, `pos_items`, `pos_orders`, `housekeeping_tasks`, `owner_payments`, `notifications`, etc.) via `syncAllDomainCollections()`.

### 4.2 Implementation Status & Audit Highlights
1. **Multi-Property Ownership**: Currently `1 Hotel Record = 1 Property`. `SuperAdmin` can switch across all hotels via the sidebar dropdown, while `Owner` and `Admin` logins bind to their single `hotel.id`.
2. **SMTP Configuration in SuperAdmin**: The fields inside `Modify Tenant Property Profile` (`editingHotel.emailSettings`) save to MongoDB on the `Hotel` record, but backend email dispatch in `server.ts` currently reads only global `process.env.EMAIL_WEBHOOK_URL`.
3. **Security Recommendations for Production Hardening**:
   - Move credential verification from `LoginView.tsx` into `POST /api/auth/login` on `server.ts`.
   - Filter `GET /api/db/state` and `POST /api/db/sync` server-side by the authenticated caller's `hotelId` so each browser only receives and updates its own tenant's data.
