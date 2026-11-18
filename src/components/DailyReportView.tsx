import React, { useState, useMemo } from 'react';
import { Room, Booking, GuestCheckIn, Invoice, Expense, Staff, HotelSettings, PaymentRecord, ExtraCharge, PosOrder, PosItem } from '../types';
import DirtyRoomsPanel from './DirtyRoomsPanel';
import { 
  Calendar, FileText, Download, Printer, Users, FileSpreadsheet,
  Search, ChevronRight, AlertCircle, TrendingUp, DollarSign, ArrowUpDown,
  ChevronLeft, ChevronRight as ChevronRightIcon, Play, Filter, RefreshCw, AlertTriangle
} from 'lucide-react';

interface DailyReportViewProps {
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  invoices: Invoice[];
  expenses: Expense[];
  staff: Staff[];
  posOrders?: PosOrder[];
  posItems?: PosItem[];
  hotelSettings?: HotelSettings;
}

type DatePreset = 'today' | 'singleDate' | 'thisWeek' | 'thisMonth' | 'custom';
type FilterDateType = 'checkin' | 'checkout' | 'stay';

export default function DailyReportView({
  rooms,
  bookings,
  checkins,
  invoices,
  expenses,
  staff,
  posOrders = [],
  posItems = [],
  hotelSettings
}: DailyReportViewProps) {
  // System context & reference dates
  const [refTodayDate, setRefTodayDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [singleDate, setSingleDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    return d.toISOString().substring(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().substring(0, 10));
  
  // Advanced query toggles
  const [filterDateType, setFilterDateType] = useState<FilterDateType>('checkin');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'all' | 'Walk-in' | 'Advance' | 'OTA'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'Cash' | 'UPI' | 'Card' | 'Bank'>('all');

  // Table states
  const [sortField, setSortField] = useState<string>('checkInDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Helper date calculations
  const startOfWeek = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().substring(0, 10);
  };

  const endOfWeek = (dateStr: string) => {
    const d = new Date(startOfWeek(dateStr));
    d.setDate(d.getDate() + 6);
    return d.toISOString().substring(0, 10);
  };

  const startOfMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().substring(0, 10);
  };

  const endOfMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().substring(0, 10);
  };

  // Determine active date range based on preset
  const activeRange = useMemo(() => {
    switch (datePreset) {
      case 'today':
        return { start: refTodayDate, end: refTodayDate };
      case 'singleDate':
        return { start: singleDate, end: singleDate };
      case 'thisWeek':
        return { start: startOfWeek(refTodayDate), end: endOfWeek(refTodayDate) };
      case 'thisMonth':
        return { start: startOfMonth(refTodayDate), end: endOfMonth(refTodayDate) };
      case 'custom':
        return { start: customStartDate, end: customEndDate };
      default:
        return { start: refTodayDate, end: refTodayDate };
    }
  }, [datePreset, refTodayDate, singleDate, customStartDate, customEndDate]);

  // Merge Bookings and Check-ins to get a unified list of operations records
  const unifiedRecords = useMemo(() => {
    const recordsMap = new Map<string, { booking?: Booking; checkin?: GuestCheckIn; invoice?: Invoice }>();

    // 1. Map all bookings
    bookings.forEach(b => {
      recordsMap.set(b.id, { booking: b });
    });

    // 2. Map/merge check-ins
    checkins.forEach(c => {
      const existing = recordsMap.get(c.id);
      if (existing) {
        existing.checkin = c;
      } else {
        recordsMap.set(c.id, { checkin: c });
      }
    });

    // 3. Map/merge invoices
    invoices.forEach(i => {
      const existing = recordsMap.get(i.bookingId);
      if (existing) {
        existing.invoice = i;
      } else {
        // Find by guest name and room number if bookingId doesn't exist
        const match = Array.from(recordsMap.values()).find(
          r => (r.booking?.id === i.bookingId) || 
               (r.checkin?.id === i.bookingId) || 
               (r.checkin?.guestName === i.guestName && r.checkin?.roomNumber === i.roomNumber)
        );
        if (match) {
          match.invoice = i;
        }
      }
    });

    // Convert merged maps to uniform report row items
    return Array.from(recordsMap.entries()).map(([id, item]) => {
      const b = item.booking;
      const c = item.checkin;
      const inv = item.invoice;

      // Guest details
      const guestName = c?.guestName || b?.guestName || 'Unknown Guest';
      const roomNumber = c?.roomNumber || b?.roomNumber || 'N/A';
      const checkInDate = c?.checkInDate || b?.checkInDate || '';
      const checkOutDate = c?.checkOutDate || b?.checkOutDate || '';
      
      // Look up Owner Name for current property/hotel.
      const hotelOwner = staff.find(s => s.department === 'Admin' || s.designation.toLowerCase().includes('owner'))?.name || hotelSettings?.name || 'Property Owner';

      // Financial breakdown: Prefer Invoice if available, fallback to Check-In or Booking calculation
      let bookingAmount = 0;
      let foodCharges = 0;
      let waterCharges = 0;
      let extraCharges = 0;
      let totalBill = 0;
      let discount = 0;
      let gst = 0;

      if (inv) {
        bookingAmount = inv.roomCharges;
        foodCharges = inv.foodCharges;
        waterCharges = inv.waterCharges;
        extraCharges = inv.otherCharges;
        discount = inv.discount || 0;
        gst = inv.gst || 0;
        totalBill = inv.finalAmount;
      } else {
        // Fallback calculations using GuestCheckIn or Booking
        const nights = c?.checkInDate && c?.checkOutDate ? 
          Math.max(1, Math.round(Math.abs(new Date(c.checkOutDate).getTime() - new Date(c.checkInDate).getTime()) / (1000 * 60 * 60 * 24))) : 
          (b?.nights || 1);

        bookingAmount = c ? (c.roomRate * nights) : (b?.bookingAmount || (b?.roomType ? 2000 * nights : 0));
        
        // Sum custom extra charges from check-in payments
        if (c?.extraCharges) {
          c.extraCharges.forEach(ec => {
            if (ec.category === 'Food') {
              foodCharges += ec.amount;
            } else if (ec.description.toLowerCase().includes('water') || ec.description.toLowerCase().includes('bottle')) {
              waterCharges += ec.amount;
            } else {
              extraCharges += ec.amount;
            }
          });
        }

        // Subtotal
        const subtotal = bookingAmount + foodCharges + waterCharges + extraCharges;
        
        // Dynamic tax calculation (e.g. 5% if subtotal < 3000, 12% if 3000-7500, 18% if > 7500)
        const taxRate = subtotal > 7500 ? 0.18 : subtotal > 3000 ? 0.12 : 0.05;
        gst = Math.round(subtotal * taxRate);
        discount = c?.discountAmount || 0;
        totalBill = subtotal + gst - discount;
      }

      // Payments calculations
      let paidAmount = 0;
      let paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank' = 'Cash';

      if (c?.payments && c.payments.length > 0) {
        paidAmount = c.payments.reduce((sum, p) => sum + p.amount, 0);
        // Determine primary payment method based on largest amount paid
        const methodSums = c.payments.reduce((acc, p) => {
          const method = p.paymentMethod || 'Cash';
          acc[method] = (acc[method] || 0) + p.amount;
          return acc;
        }, {} as Record<string, number>);

        let maxVal = -1;
        Object.entries(methodSums).forEach(([method, val]) => {
          if (val > maxVal) {
            maxVal = val;
            paymentMethod = method as any;
          }
        });
      } else {
        // Fallback to advanceAmount on checkin or booking
        paidAmount = c ? c.advanceAmount : (b?.advanceAmount || 0);
        paymentMethod = (c ? (c.paymentMethod || 'Cash') : (b?.paymentMethod === 'Online' ? 'UPI' : (b?.paymentMethod || 'Cash'))) as any;
      }

      const pendingAmount = Math.max(0, totalBill - paidAmount);

      // Booking Type
      let bookingType: 'Walk-in' | 'Advance' | 'OTA' = 'Walk-in';
      const bSource = b?.bookingSource || 'Walk-in';
      if (['OYO', 'Agoda', 'Booking.com', 'Goibibo', 'MakeMyTrip'].includes(bSource)) {
        bookingType = 'OTA';
      } else if (b && !b.isCheckedIn) {
        bookingType = 'Advance';
      }

      const otaName = bookingType === 'OTA' ? bSource : '';

      return {
        id,
        guestName,
        ownerName: hotelOwner,
        roomNumber,
        bookingAmount,
        extraCharges,
        foodCharges,
        waterCharges,
        totalBill,
        paymentMethod,
        bookingType,
        otaName,
        paidAmount,
        pendingAmount,
        checkInDate,
        checkOutDate,
        rawBooking: b,
        rawCheckin: c
      };
    });
  }, [bookings, checkins, invoices, staff]);

  // Filter records by Date range, Search, Booking Type, and Payment Method
  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter(r => {
      // 1. Date Range filtering
      const dateToCompare = 
        filterDateType === 'checkin' ? r.checkInDate : 
        filterDateType === 'checkout' ? r.checkOutDate : 
        null;

      if (filterDateType === 'stay') {
        // Any active stay overlap with activeRange
        const stayIn = r.checkInDate;
        const stayOut = r.checkOutDate;
        const start = activeRange.start;
        const end = activeRange.end;
        if (!stayIn || !stayOut) return false;
        // overlap condition
        if (stayIn > end || stayOut < start) return false;
      } else {
        if (!dateToCompare) return false;
        if (dateToCompare < activeRange.start || dateToCompare > activeRange.end) {
          return false;
        }
      }

      // 2. Booking Type filter
      if (bookingTypeFilter !== 'all' && r.bookingType !== bookingTypeFilter) {
        return false;
      }

      // 3. Payment Method filter
      if (paymentMethodFilter !== 'all' && r.paymentMethod !== paymentMethodFilter) {
        return false;
      }

      // 4. Search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          r.id.toLowerCase().includes(query) ||
          r.guestName.toLowerCase().includes(query) ||
          r.roomNumber.toLowerCase().includes(query) ||
          r.ownerName.toLowerCase().includes(query) ||
          r.otaName.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [unifiedRecords, activeRange, filterDateType, bookingTypeFilter, paymentMethodFilter, searchTerm]);

  // Aggregate stats at the bottom & for cards
  const aggregates = useMemo(() => {
    let totalBusiness = 0;
    let totalCashReceived = 0;
    let totalUPIReceived = 0;
    let totalCardReceived = 0;
    let totalBankTransfer = 0;
    let totalOTAReceived = 0;
    let totalPendingPayment = 0;
    let totalExtraCharges = 0;
    let totalFoodSales = 0;
    let totalWaterBottleSales = 0;

    // Advance booking specific metrics
    let totalAdvanceBookingsCount = 0;
    let totalAdvanceAmountReceived = 0;
    let pendingAdvanceAmount = 0;
    let advanceCashReceived = 0;
    let advanceUPIReceived = 0;
    let advanceCardBankReceived = 0;
    let totalAdvanceBookingValue = 0;

    filteredRecords.forEach(r => {
      totalBusiness += r.totalBill;
      totalPendingPayment += r.pendingAmount;
      totalExtraCharges += r.extraCharges;
      totalFoodSales += r.foodCharges;
      totalWaterBottleSales += r.waterCharges;

      // Split paid amounts by actual recorded payment methods or fallback
      const c = r.rawCheckin;
      if (c?.payments && c.payments.length > 0) {
        c.payments.forEach(p => {
          if (p.paymentMethod === 'Cash') totalCashReceived += p.amount;
          else if (p.paymentMethod === 'UPI') totalUPIReceived += p.amount;
          else if (p.paymentMethod === 'Card') totalCardReceived += p.amount;
          else if (p.paymentMethod === 'Bank') totalBankTransfer += p.amount;
        });
      } else {
        // fallback mapping
        if (r.paymentMethod === 'Cash') totalCashReceived += r.paidAmount;
        else if (r.paymentMethod === 'UPI') totalUPIReceived += r.paidAmount;
        else if (r.paymentMethod === 'Card') totalCardReceived += r.paidAmount;
        else if (r.paymentMethod === 'Bank') totalBankTransfer += r.paidAmount;
      }

      // OTA receipts
      if (r.bookingType === 'OTA') {
        totalOTAReceived += r.paidAmount;
      }

      // Advance Booking calculations
      if (r.bookingType === 'Advance') {
        totalAdvanceBookingsCount += 1;
        totalAdvanceAmountReceived += r.paidAmount;
        pendingAdvanceAmount += r.pendingAmount;
        totalAdvanceBookingValue += r.totalBill;

        if (r.paymentMethod === 'Cash') {
          advanceCashReceived += r.paidAmount;
        } else if (r.paymentMethod === 'UPI') {
          advanceUPIReceived += r.paidAmount;
        } else if (r.paymentMethod === 'Card' || r.paymentMethod === 'Bank' || r.paymentMethod === 'Online') {
          advanceCardBankReceived += r.paidAmount;
        }
      }
    });

    return {
      totalBusiness,
      totalCashReceived,
      totalUPIReceived,
      totalCardReceived,
      totalBankTransfer,
      totalOTAReceived,
      totalPendingPayment,
      totalExtraCharges,
      totalFoodSales,
      totalWaterBottleSales,
      totalAdvanceBookingsCount,
      totalAdvanceAmountReceived,
      pendingAdvanceAmount,
      advanceCashReceived,
      advanceUPIReceived,
      advanceCardBankReceived,
      totalAdvanceBookingValue
    };
  }, [filteredRecords]);

  // Sorting logic
  const sortedRecords = useMemo(() => {
    const data = [...filteredRecords];
    data.sort((a, b) => {
      let valA = (a as any)[sortField];
      let valB = (b as any)[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [filteredRecords, sortField, sortDirection]);

  // Pagination logic
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // default to descending
    }
    setCurrentPage(1);
  };

  // Export Utilities
  const handlePrint = () => {
    window.print();
  };

  const handleCSVExport = () => {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'DIRECTSTAY DAILY REPORT STATEMENT\n';
    csv += `Audit Date Range,${activeRange.start} to ${activeRange.end} (Filter: ${filterDateType.toUpperCase()})\n`;
    csv += `Generated Time,${new Date().toLocaleString()}\n\n`;

    const headers = [
      'Booking ID', 'Guest Name', 'Owner Name', 'Room Number', 'Booking Amount (INR)', 
      'Extra Charges', 'Food Charges', 'Water Bottle Charges', 'Total Bill', 
      'Payment Method', 'Booking Type', 'OTA Name', 'Paid Amount', 'Pending Amount', 
      'Check-in Date', 'Check-out Date'
    ];
    csv += headers.join(',') + '\n';

    sortedRecords.forEach(r => {
      const row = [
        `"${r.id}"`,
        `"${r.guestName.replace(/"/g, '""')}"`,
        `"${r.ownerName.replace(/"/g, '""')}"`,
        `"${r.roomNumber}"`,
        r.bookingAmount,
        r.extraCharges,
        r.foodCharges,
        r.waterCharges,
        r.totalBill,
        r.paymentMethod,
        r.bookingType,
        `"${r.otaName}"`,
        r.paidAmount,
        r.pendingAmount,
        r.checkInDate,
        r.checkOutDate
      ];
      csv += row.join(',') + '\n';
    });

    csv += '\n';
    csv += 'SUMMARY TOTALS\n';
    csv += `Total Business Value,₹${aggregates.totalBusiness}\n`;
    csv += `Total Cash Received,₹${aggregates.totalCashReceived}\n`;
    csv += `Total UPI Received,₹${aggregates.totalUPIReceived}\n`;
    csv += `Total Card Received,₹${aggregates.totalCardReceived}\n`;
    csv += `Total Bank Transfer,₹${aggregates.totalBankTransfer}\n`;
    csv += `Total OTA Received,₹${aggregates.totalOTAReceived}\n`;
    csv += `Total Pending Payment,₹${aggregates.totalPendingPayment}\n`;
    csv += `Total Extra Charges,₹${aggregates.totalExtraCharges}\n`;
    csv += `Total Food Sales,₹${aggregates.totalFoodSales}\n`;
    csv += `Total Water Bottle Sales,₹${aggregates.totalWaterBottleSales}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `daily_report_${activeRange.start}_to_${activeRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelExport = () => {
    // Generate an XML-based structured Spreadsheet format readable by Excel
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
    xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
    xml += ' <Styles>\n';
    xml += '  <Style ss:ID="HeaderStyle"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#4A3B32" ss:Pattern="Solid"/></Style>\n';
    xml += '  <Style ss:ID="TitleStyle"><Font ss:Size="14" ss:Bold="1" ss:Color="#C5A059"/></Style>\n';
    xml += '  <Style ss:ID="TotalStyle"><Font ss:Bold="1"/><Interior ss:Color="#F4F1EA" ss:Pattern="Solid"/></Style>\n';
    xml += ' </Styles>\n';
    xml += ' <Worksheet ss:Name="Daily Report">\n';
    xml += '  <Table>\n';
    
    // Add title
    xml += '   <Row><Cell ss:StyleID="TitleStyle"><Data ss:Type="String">DIRECTSTAY BOUTIQUE PMS - DAILY REPORT STATEMENT</Data></Cell></Row>\n';
    xml += `   <Row><Cell><Data ss:Type="String">Period: ${activeRange.start} to ${activeRange.end} | Filter: ${filterDateType.toUpperCase()}</Data></Cell></Row>\n`;
    xml += '   <Row ss:Index="4">\n';

    const headers = [
      'Booking ID', 'Guest Name', 'Owner Name', 'Room Number', 'Booking Amount', 
      'Extra Charges', 'Food Charges', 'Water Bottle Charges', 'Total Bill', 
      'Payment Method', 'Booking Type', 'OTA Name', 'Paid Amount', 'Pending Amount', 
      'Check-in Date', 'Check-out Date'
    ];

    headers.forEach(h => {
      xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${h}</Data></Cell>\n`;
    });
    xml += '   </Row>\n';

    sortedRecords.forEach(r => {
      xml += '   <Row>\n';
      xml += `    <Cell><Data ss:Type="String">${r.id}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${r.guestName}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${r.ownerName}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${r.roomNumber}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${r.bookingAmount}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${r.extraCharges}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${r.foodCharges}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${r.waterCharges}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${r.totalBill}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${r.paymentMethod}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${r.bookingType}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${r.otaName || 'N/A'}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${r.paidAmount}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${r.pendingAmount}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${r.checkInDate}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${r.checkOutDate}</Data></Cell>\n`;
      xml += '   </Row>\n';
    });

    // Totals rows
    xml += '   <Row ss:Index="' + (sortedRecords.length + 6) + '">\n';
    xml += '    <Cell ss:StyleID="TotalStyle"><Data ss:Type="String">SUMMARY TOTALS</Data></Cell>\n';
    xml += '   </Row>\n';
    
    const summaryItems = [
      ['Total Business Value', aggregates.totalBusiness],
      ['Total Cash Received', aggregates.totalCashReceived],
      ['Total UPI Received', aggregates.totalUPIReceived],
      ['Total Card Received', aggregates.totalCardReceived],
      ['Total Bank Transfer', aggregates.totalBankTransfer],
      ['Total OTA Received', aggregates.totalOTAReceived],
      ['Total Pending Payment', aggregates.totalPendingPayment],
      ['Total Extra Charges', aggregates.totalExtraCharges],
      ['Total Food Sales', aggregates.totalFoodSales],
      ['Total Water Bottle Sales', aggregates.totalWaterBottleSales],
    ];

    summaryItems.forEach(([label, val]) => {
      xml += '   <Row>\n';
      xml += `    <Cell ss:StyleID="TotalStyle"><Data ss:Type="String">${label}</Data></Cell>\n`;
      xml += `    <Cell ss:StyleID="TotalStyle"><Data ss:Type="Number">${val}</Data></Cell>\n`;
      xml += '   </Row>\n';
    });

    xml += '  </Table>\n';
    xml += ' </Worksheet>\n';
    xml += '</Workbook>\n';

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `daily_report_${activeRange.start}_to_${activeRange.end}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* ----------------- BRANDING HEADER (PRINT ONLY) ----------------- */}
      <div className="hidden print:block mb-6 border-b-2 border-luxury-brown-900 pb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif text-luxury-brown-900 font-bold tracking-tight">
              {hotelSettings?.name || 'GRAND PAVILION'}
            </h1>
            <p className="text-[10px] uppercase font-mono tracking-widest text-[#C5A059] font-bold mt-1">
              Official Daily Operations & Financial Audit Statement
            </p>
          </div>
          <div className="text-right text-[10px] font-mono text-gray-600">
            <p>Report Period: {activeRange.start} to {activeRange.end}</p>
            <p>Filter Criteria: {filterDateType.toUpperCase()} Date</p>
            <p>System Time: {new Date().toLocaleString()}</p>
            <p>Property Manager: Raghu Sir</p>
          </div>
        </div>
      </div>

      {/* ----------------- TITLE HEADER ----------------- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b border-luxury-beige-100 pb-4 no-print gap-4">
        <div>
          <span className="text-xs uppercase font-mono tracking-widest text-[#C5A059] font-bold block mb-1">
            DirectStay Business Intelligence
          </span>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide">
            Daily Report Dashboard
          </h1>
          <p className="text-xs text-luxury-brown-500">
            Generate and audit professional financial registers, food sales, water logs, and multi-channel booking lists.
          </p>
        </div>

        {/* Global Reference Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold uppercase text-luxury-brown-500">Selected Date:</span>
            <input
              type="date"
              value={refTodayDate}
              onChange={(e) => {
                setRefTodayDate(e.target.value);
                setSingleDate(e.target.value);
              }}
              className="px-2.5 py-1.5 border border-luxury-brown-200 bg-white rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
            />
          </div>
        </div>
      </div>

      {/* ----------------- KPI REPORT CARDS (TOP SUMMARY) ----------------- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 no-print">
        <div className="bg-white border border-luxury-beige-200 p-4 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="text-gray-400 text-[10px] uppercase font-mono font-bold tracking-wider">
            Total Business
          </div>
          <div className="text-xl md:text-2xl font-bold font-serif text-luxury-brown-950 mt-1">
            ₹{Number(aggregates.totalBusiness || 0).toLocaleString()}
          </div>
          <div className="text-[9px] text-luxury-gold-600 font-mono mt-1 flex items-center gap-1 font-semibold">
            <TrendingUp className="w-3 h-3 text-luxury-gold-500" /> Revenue ledger
          </div>
        </div>

        <div className="bg-white border border-emerald-100 p-4 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="text-emerald-600 text-[10px] uppercase font-mono font-bold tracking-wider">
            Cash Received
          </div>
          <div className="text-xl md:text-2xl font-bold font-serif text-emerald-800 mt-1">
            ₹{Number(aggregates.totalCashReceived || 0).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-400 font-mono mt-1">
            In hand drawer cash
          </div>
        </div>

        <div className="bg-white border border-blue-100 p-4 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="text-blue-600 text-[10px] uppercase font-mono font-bold tracking-wider">
            UPI Received
          </div>
          <div className="text-xl md:text-2xl font-bold font-serif text-blue-800 mt-1">
            ₹{Number(aggregates.totalUPIReceived || 0).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-400 font-mono mt-1">
            Instant digital UPI bank
          </div>
        </div>

        <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="text-amber-600 text-[10px] uppercase font-mono font-bold tracking-wider">
            Card & Bank
          </div>
          <div className="text-xl md:text-2xl font-bold font-serif text-amber-800 mt-1">
            ₹{(aggregates.totalCardReceived + aggregates.totalBankTransfer).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-400 font-mono mt-1">
            Credit cards / Bank transfers
          </div>
        </div>

        <div className="bg-[#9E2A2B]/5 border border-[#9E2A2B]/10 p-4 rounded-xl shadow-2xs flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="text-[#9E2A2B] text-[10px] uppercase font-mono font-bold tracking-wider">
            Pending Balance
          </div>
          <div className="text-xl md:text-2xl font-bold font-serif text-[#9E2A2B] mt-1">
            ₹{Number(aggregates.totalPendingPayment || 0).toLocaleString()}
          </div>
          <div className="text-[9px] text-[#9E2A2B]/70 font-mono mt-1 font-semibold">
            Outstanding receivables
          </div>
        </div>
      </div>

      {/* ----------------- ADVANCE BOOKING SUMMARY CARDS ----------------- */}
      <div className="bg-luxury-beige-50/40 border border-luxury-gold-500/15 p-4 rounded-2xl space-y-3 no-print">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-luxury-brown-700 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9E2A2B]"></span>
          Advance Booking Financials
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white border border-luxury-beige-200/60 p-3 rounded-xl shadow-3xs flex flex-col justify-between">
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-luxury-brown-500">Total Advance Bookings</span>
            <span className="text-lg font-bold font-serif text-luxury-brown-900 mt-0.5">{aggregates.totalAdvanceBookingsCount}</span>
            <span className="text-[8px] text-luxury-brown-400 font-mono mt-0.5">Reservations count</span>
          </div>

          <div className="bg-white border border-emerald-100 p-3 rounded-xl shadow-3xs flex flex-col justify-between">
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-emerald-600">Advance Received</span>
            <span className="text-lg font-bold font-serif text-emerald-800 mt-0.5">₹{Number(aggregates.totalAdvanceAmountReceived || 0).toLocaleString()}</span>
            <span className="text-[8px] text-emerald-600 font-mono mt-0.5">Amount in bank</span>
          </div>

          <div className="bg-white border border-rose-100 p-3 rounded-xl shadow-3xs flex flex-col justify-between">
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-rose-600">Pending Advance</span>
            <span className="text-lg font-bold font-serif text-rose-800 mt-0.5">₹{Number(aggregates.pendingAdvanceAmount || 0).toLocaleString()}</span>
            <span className="text-[8px] text-rose-600 font-mono mt-0.5">Receivable balance</span>
          </div>

          <div className="bg-white border border-emerald-50 p-3 rounded-xl shadow-3xs flex flex-col justify-between">
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-emerald-700">Cash Received</span>
            <span className="text-lg font-bold font-serif text-emerald-800 mt-0.5">₹{Number(aggregates.advanceCashReceived || 0).toLocaleString()}</span>
            <span className="text-[8px] text-emerald-600/70 font-mono mt-0.5">Cash advance</span>
          </div>

          <div className="bg-white border border-blue-50 p-3 rounded-xl shadow-3xs flex flex-col justify-between">
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-blue-700">UPI Received</span>
            <span className="text-lg font-bold font-serif text-blue-800 mt-0.5">₹{Number(aggregates.advanceUPIReceived || 0).toLocaleString()}</span>
            <span className="text-[8px] text-blue-600/70 font-mono mt-0.5">UPI advance</span>
          </div>

          <div className="bg-white border border-amber-50 p-3 rounded-xl shadow-3xs flex flex-col justify-between">
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-amber-700">Card/Bank Received</span>
            <span className="text-lg font-bold font-serif text-amber-800 mt-0.5">₹{Number(aggregates.advanceCardBankReceived || 0).toLocaleString()}</span>
            <span className="text-[8px] text-amber-600/70 font-mono mt-0.5">Plastic/wire advance</span>
          </div>

          <div className="bg-luxury-brown-900 border border-luxury-gold-500/20 p-3 rounded-xl shadow-3xs flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-luxury-gold-300">Total Advance Value</span>
            <span className="text-lg font-bold font-serif text-luxury-gold-100 mt-0.5">₹{Number(aggregates.totalAdvanceBookingValue || 0).toLocaleString()}</span>
            <span className="text-[8px] text-luxury-brown-300 font-mono mt-0.5">Sum of all bills</span>
          </div>
        </div>
      </div>

      {/* ----------------- FILTERS BAR (NO PRINT) ----------------- */}
      <div className="bg-white border rounded-2xl p-4 md:p-5 shadow-sm space-y-4 no-print">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          
          {/* Preset Buttons */}
          <div className="lg:col-span-5 space-y-1">
            <label className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">
              Report Timeline Preset
            </label>
            <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl border">
              {[
                { id: 'today', label: 'Today' },
                { id: 'singleDate', label: 'Single Date' },
                { id: 'thisWeek', label: 'This Week' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'custom', label: 'Custom Range' }
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setDatePreset(preset.id as DatePreset);
                    setCurrentPage(1);
                  }}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    datePreset === preset.id
                      ? 'bg-white text-luxury-brown-950 font-bold shadow-xs border'
                      : 'text-gray-600 hover:text-luxury-brown-950'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Date Selectors */}
          <div className="lg:col-span-4">
            {datePreset === 'singleDate' && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-gray-500 block font-bold">Select Date</label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => {
                    setSingleDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-mono bg-white focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                />
              </div>
            )}

            {datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-gray-500 block font-bold">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 border rounded-xl text-xs font-mono bg-white focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-gray-500 block font-bold">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 border rounded-xl text-xs font-mono bg-white focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {(datePreset === 'today' || datePreset === 'thisWeek' || datePreset === 'thisMonth') && (
              <div className="bg-luxury-beige-50/50 px-3 py-2.5 rounded-xl border border-dashed border-luxury-brown-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-bold leading-none">
                    Calculated Range
                  </span>
                  <strong className="font-mono text-luxury-brown-900 block mt-0.5">
                    {activeRange.start} <span className="text-luxury-brown-400">to</span> {activeRange.end}
                  </strong>
                </div>
                <Calendar className="w-4 h-4 text-luxury-gold-600" />
              </div>
            )}
          </div>

          {/* Date Type Match Toggle */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">
              Match Range By
            </label>
            <select
              value={filterDateType}
              onChange={(e) => {
                setFilterDateType(e.target.value as FilterDateType);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
            >
              <option value="checkin">Check-in Date</option>
              <option value="checkout">Check-out Date</option>
              <option value="stay">Active Stay Period</option>
            </select>
          </div>

        </div>

        {/* ----------------- SEARCH & SPECIALIZED DROPDOWN FILTERS ----------------- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Guest, ID, Room, Owner..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs bg-white focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={bookingTypeFilter}
              onChange={(e) => {
                setBookingTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
            >
              <option value="all">All Booking Types</option>
              <option value="Walk-in">Walk-in Desk</option>
              <option value="Advance">Advance reservation</option>
              <option value="OTA">OTA Channels</option>
            </select>
          </div>

          <div>
            <select
              value={paymentMethodFilter}
              onChange={(e) => {
                setPaymentMethodFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
            >
              <option value="all">All Payment Methods</option>
              <option value="Cash">Cash Ledger</option>
              <option value="UPI">UPI Digital</option>
              <option value="Card">Credit Card</option>
              <option value="Bank">Bank Transfer</option>
            </select>
          </div>

          {/* Export and Print Quick Actions */}
          <div className="flex gap-1">
            <button 
              onClick={handlePrint}
              className="flex-1 py-2 border rounded-xl text-xs font-bold font-sans bg-white hover:bg-gray-50 flex items-center justify-center gap-1 transition-colors border-luxury-brown-300 text-luxury-brown-900 cursor-pointer"
              title="Print PDF"
            >
              <Printer className="w-3.5 h-3.5 text-[#9E2A2B]" /> 
              <span>Print/PDF</span>
            </button>
            <button 
              onClick={handleCSVExport}
              className="px-2.5 border rounded-xl bg-white hover:bg-gray-50 flex items-center justify-center text-luxury-brown-800 transition-colors border-luxury-brown-300 cursor-pointer"
              title="Export CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </button>
            <button 
              onClick={handleExcelExport}
              className="px-2.5 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
              title="Export Excel"
            >
              <Download className="w-4 h-4 text-luxury-gold-400" />
            </button>
          </div>

        </div>

      </div>

      {/* ----------------- DATA TABLE SECTION ----------------- */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden no-print">
        
        {/* Table Title and Actions */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="font-serif font-bold text-luxury-brown-950 text-sm">
              Operational Ledger List
            </h3>
            <p className="text-[10px] text-gray-500">
              Showing <strong className="text-luxury-brown-900">{filteredRecords.length}</strong> entries matching your query
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded-md px-1 py-0.5 bg-white font-mono text-[11px]"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <span>rows per page</span>
          </div>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-luxury-beige-50/40 text-luxury-brown-900 font-bold border-b border-luxury-beige-100 select-none">
              <tr>
                {[
                  { field: 'id', label: 'Booking ID' },
                  { field: 'guestName', label: 'Guest Name' },
                  { field: 'ownerName', label: 'Owner Name' },
                  { field: 'roomNumber', label: 'Room' },
                  { field: 'bookingAmount', label: 'Booking Amt' },
                  { field: 'extraCharges', label: 'Extra Chg' },
                  { field: 'foodCharges', label: 'Food Chg' },
                  { field: 'waterCharges', label: 'Water Chg' },
                  { field: 'totalBill', label: 'Total Bill' },
                  { field: 'paymentMethod', label: 'Payment' },
                  { field: 'bookingType', label: 'Type' },
                  { field: 'otaName', label: 'OTA Name' },
                  { field: 'paidAmount', label: 'Paid' },
                  { field: 'pendingAmount', label: 'Pending' },
                  { field: 'checkInDate', label: 'Check-In' },
                  { field: 'checkOutDate', label: 'Check-Out' }
                ].map(col => (
                  <th 
                    key={col.field}
                    onClick={() => handleSort(col.field)}
                    className="p-4 cursor-pointer hover:bg-luxury-beige-50/60 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      <ArrowUpDown className={`w-3.5 h-3.5 text-luxury-brown-400 ${sortField === col.field ? 'text-luxury-gold-600 font-bold' : ''}`} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-luxury-brown-900">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={16} className="p-8 text-center text-gray-400 italic">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-luxury-brown-300" />
                      <span>No records found matching your selected date and query parameters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-luxury-beige-50/10 transition-colors">
                    <td className="p-4 font-mono font-bold text-luxury-brown-950 whitespace-nowrap select-all">
                      {r.id}
                    </td>
                    <td className="p-4 font-semibold whitespace-nowrap">
                      {r.guestName}
                    </td>
                    <td className="p-4 text-luxury-brown-500 whitespace-nowrap">
                      {r.ownerName}
                    </td>
                    <td className="p-4 font-mono font-bold whitespace-nowrap">
                      Room {r.roomNumber}
                    </td>
                    <td className="p-4 font-mono text-right font-semibold">
                      ₹{Number(r.bookingAmount || 0).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-right text-purple-700 font-semibold">
                      ₹{Number(r.extraCharges || 0).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-right text-orange-700 font-semibold">
                      ₹{Number(r.foodCharges || 0).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-right text-sky-700 font-semibold">
                      ₹{Number(r.waterCharges || 0).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-right font-bold text-luxury-brown-950">
                      ₹{Number(r.totalBill || 0).toLocaleString()}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {(() => {
                        switch (r.paymentMethod) {
                          case 'Cash':
                            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100">💵 Cash</span>;
                          case 'UPI':
                            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-100">📱 UPI</span>;
                          case 'Card':
                            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-100">💳 Card</span>;
                          case 'Bank':
                          default:
                            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-100">🏦 Bank</span>;
                        }
                      })()}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {(() => {
                        switch (r.bookingType) {
                          case 'OTA':
                            return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-blue-700 bg-blue-50">OTA</span>;
                          case 'Advance':
                            return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-purple-700 bg-purple-50">Advance</span>;
                          case 'Walk-in':
                          default:
                            return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-emerald-700 bg-emerald-50">Walk-in</span>;
                        }
                      })()}
                    </td>
                    <td className="p-4 whitespace-nowrap italic text-gray-500 font-medium">
                      {r.otaName || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-4 font-mono text-right font-bold text-emerald-700">
                      ₹{Number(r.paidAmount || 0).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-right font-bold text-[#9E2A2B]">
                      ₹{Number(r.pendingAmount || 0).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-gray-500 whitespace-nowrap">
                      {r.checkInDate}
                    </td>
                    <td className="p-4 font-mono text-gray-500 whitespace-nowrap">
                      {r.checkOutDate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="p-1.5 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    currentPage === i + 1
                      ? 'bg-luxury-brown-950 border-luxury-brown-950 text-white shadow-xs'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="p-1.5 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ----------------- DIRTY ROOMS (housekeeping state for audit) ----------------- */}
      <DirtyRoomsPanel rooms={rooms} checkins={checkins} />

      {/* ----------------- POINT 5: TARIFF & FOOD PRICE DEVIATION AUDIT IN DAILY SHIFT NIGHT AUDIT ----------------- */}
      {(() => {
        const shiftStays = checkins.filter(c => {
          const ci = String(c.checkInDate || '').slice(0, 10);
          const co = String((c.checkedOutDateTime || c.checkOutDate || ci)).slice(0, 10);
          return ci <= activeRange.end && co >= activeRange.start;
        });
        const roomDevs = shiftStays
          .map(c => {
            const rm = rooms.find(r => r.number === c.roomNumber);
            const std = Number(c.originalRate) > 0 ? Number(c.originalRate) : Number(rm?.rate || 0);
            const chg = Number(c.roomRate || 0);
            const nts = Math.max(
              1,
              Number(c.nights || c.stayNights) ||
                (c.checkInDate && c.checkOutDate
                  ? Math.max(1, Math.round((new Date(c.checkOutDate).getTime() - new Date(c.checkInDate).getTime()) / 86400000))
                  : 1)
            );
            const disc = Number(c.discount ?? c.discountAmount ?? 0);
            const perNightDiff = std > 0 ? chg - std : 0;
            const netVar = perNightDiff * nts - disc;
            return {
              id: c.id,
              guestName: c.guestName,
              roomNumber: c.roomNumber,
              nights: nts,
              std,
              chg,
              disc,
              perNightDiff,
              netVar,
              staffName: c.checkedInBy || 'Reception',
            };
          })
          .filter(d => Math.abs(d.perNightDiff) >= 0.5 || d.disc > 0);

        const shiftPos = posOrders.filter(o => {
          if (!o || o.status === 'Cancelled' || !o.date) return false;
          const d = String(o.date).slice(0, 10);
          return d >= activeRange.start && d <= activeRange.end;
        });
        const foodDevs = shiftPos.flatMap(o =>
          (o.items || [])
            .map(it => {
              const cat = posItems.find(p => p.id === it.itemId || p.name.trim().toLowerCase() === String(it.itemName || '').trim().toLowerCase());
              const fixedPrice = it.menuPrice !== undefined ? Number(it.menuPrice) : Number(cat?.price ?? it.price);
              const billedPrice = Number(it.price || 0);
              const lineDiff = (billedPrice - fixedPrice) * Number(it.quantity || 1);
              return {
                orderNumber: o.orderNumber,
                target: o.roomNumber ? `Room ${o.roomNumber}` : o.tableNo ? `Table ${o.tableNo}` : (o.guestName || 'Walk-in'),
                itemName: it.itemName,
                qty: Number(it.quantity || 1),
                fixedPrice,
                billedPrice,
                lineDiff,
                isWithoutGst: Boolean(o.isWithoutGst),
              };
            })
            .filter(f => Math.abs(f.billedPrice - f.fixedPrice) >= 0.5)
        );
        const nonGstKots = shiftPos.filter(o => o.isWithoutGst === true);

        return (
          <div className="bg-white border border-amber-300 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="border-b border-amber-100 pb-3 flex flex-wrap justify-between items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Night Audit Deviation Report — Room Tariffs &amp; Food / KOT Prices
                </h3>
                <p className="text-[11px] text-slate-500">
                  Deviation from fixed room rack rates, additional check-in discounts, and fixed menu prices ({activeRange.start} to {activeRange.end}).
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                  Room Deviations: {roomDevs.length}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-900">
                  Food KOT Deviations: {foodDevs.length}
                </span>
                {nonGstKots.length > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                    GST-Excluded KOTs: {nonGstKots.length}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              <div>
                <h4 className="font-mono font-bold uppercase text-[10.5px] text-slate-700 mb-2">Room Tariff &amp; Discount Deviations</h4>
                {roomDevs.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-800 text-center">
                    ✓ No room tariff or discount deviations in this audit period.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-[11px] divide-y divide-slate-200">
                      <thead className="bg-slate-50 font-mono uppercase text-[9.5px] font-bold text-slate-600">
                        <tr>
                          <th className="p-2">Guest / Room</th>
                          <th className="p-2 text-right">Fixed</th>
                          <th className="p-2 text-right">Charged</th>
                          <th className="p-2 text-right">Disc.</th>
                          <th className="p-2 text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {roomDevs.map(d => (
                          <tr key={d.id}>
                            <td className="p-2">
                              <div className="font-bold text-slate-900">{d.guestName} (Rm {d.roomNumber})</div>
                              <div className="text-[9.5px] font-mono text-slate-500">{d.nights}N • By: {d.staffName}</div>
                            </td>
                            <td className="p-2 text-right font-mono">₹{d.std}</td>
                            <td className="p-2 text-right font-mono font-bold">₹{d.chg}</td>
                            <td className="p-2 text-right font-mono text-amber-800">{d.disc > 0 ? `-₹${d.disc}` : '₹0'}</td>
                            <td className={`p-2 text-right font-mono font-bold ${d.netVar < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {d.netVar < 0 ? `-₹${Math.abs(d.netVar)}` : `+₹${d.netVar}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-mono font-bold uppercase text-[10.5px] text-slate-700 mb-2">Food / KOT Price &amp; GST Deviations</h4>
                {foodDevs.length === 0 && nonGstKots.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-800 text-center">
                    ✓ No KOT food price deviations or GST exclusions in this audit period.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {foodDevs.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-left text-[11px] divide-y divide-slate-200">
                          <thead className="bg-slate-50 font-mono uppercase text-[9.5px] font-bold text-slate-600">
                            <tr>
                              <th className="p-2">KOT / Item</th>
                              <th className="p-2 text-right">Menu</th>
                              <th className="p-2 text-right">Billed</th>
                              <th className="p-2 text-right">Variance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {foodDevs.map((f, i) => (
                              <tr key={i}>
                                <td className="p-2">
                                  <div className="font-bold text-slate-900">{f.itemName} × {f.qty}</div>
                                  <div className="text-[9.5px] font-mono text-slate-500">#{f.orderNumber} • {f.target}</div>
                                </td>
                                <td className="p-2 text-right font-mono">₹{f.fixedPrice}</td>
                                <td className="p-2 text-right font-mono font-bold">₹{f.billedPrice}</td>
                                <td className={`p-2 text-right font-mono font-bold ${f.lineDiff < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  {f.lineDiff < 0 ? `-₹${Math.abs(f.lineDiff)}` : `+₹${f.lineDiff}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {nonGstKots.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 font-mono text-[11px] space-y-1">
                        <div className="font-bold text-amber-900 text-[10px] uppercase">KOTs with GST Excluded (0%):</div>
                        {nonGstKots.map(k => (
                          <div key={k.id} className="flex justify-between">
                            <span>#{k.orderNumber} ({k.roomNumber ? `Rm ${k.roomNumber}` : k.tableNo ? `Tbl ${k.tableNo}` : 'Walk-in'})</span>
                            <span className="font-bold">₹{Number(k.grandTotal || 0).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ----------------- BOTTOM SUMMARY CALCULATIONS CARD ----------------- */}
      <div className="bg-luxury-brown-900 text-white rounded-2xl p-6 md:p-8 border border-luxury-gold-500/30 shadow-lg space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-luxury-gold-500/20 pb-4 gap-2">
          <div>
            <h3 className="font-serif font-bold text-lg text-luxury-gold-400">
              Calculated Period Aggregates
            </h3>
            <p className="text-[11px] text-luxury-brown-200 font-mono">
              Summary report generated for timeframe: {activeRange.start} to {activeRange.end}
            </p>
          </div>
          <span className="px-3 py-1 bg-luxury-gold-500/20 text-luxury-gold-300 font-mono text-[10px] uppercase font-bold rounded border border-luxury-gold-500/30">
            System verified audits
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
          
          {/* Main revenue metrics (Col span 4) */}
          <div className="md:col-span-4 space-y-4">
            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/10">
              <span className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-300 block">
                Total Business Value (Bookings + Extras)
              </span>
              <strong className="text-3xl font-serif font-bold text-luxury-gold-400 block mt-1">
                ₹{Number(aggregates.totalBusiness || 0).toLocaleString()}
              </strong>
              <p className="text-[10px] text-luxury-brown-400 mt-1.5 italic font-medium leading-normal">
                Reflects sum of room tariffs, dining sales, bottled water consumption, and auxiliary guest charges before taxes.
              </p>
            </div>

            <div className="bg-rose-950/25 p-4 rounded-xl border border-[#9E2A2B]/25">
              <span className="text-[10px] uppercase tracking-wider font-mono text-rose-300 block">
                Total Outstanding Receivables
              </span>
              <strong className="text-2xl font-serif font-bold text-rose-400 block mt-1">
                ₹{Number(aggregates.totalPendingPayment || 0).toLocaleString()}
              </strong>
              <p className="text-[10px] text-rose-300/70 mt-1">
                Cumulative due payments pending settlement.
              </p>
            </div>
          </div>

          {/* Collection Receipts Channels (Col span 3) */}
          <div className="md:col-span-3 space-y-3.5 bg-luxury-brown-950/40 p-4 rounded-xl border border-luxury-gold-500/5">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-luxury-gold-400 font-bold">
              Collections By Channel
            </h4>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-luxury-brown-300">💵 Total Cash Drawer</span>
              <strong className="font-mono text-white">₹{Number(aggregates.totalCashReceived || 0).toLocaleString()}</strong>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-luxury-brown-300">📱 Total UPI Receipts</span>
              <strong className="font-mono text-white">₹{Number(aggregates.totalUPIReceived || 0).toLocaleString()}</strong>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-luxury-brown-300">💳 Total Cards Received</span>
              <strong className="font-mono text-white">₹{Number(aggregates.totalCardReceived || 0).toLocaleString()}</strong>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-luxury-brown-300">🏦 Total Bank Transfers</span>
              <strong className="font-mono text-white">₹{Number(aggregates.totalBankTransfer || 0).toLocaleString()}</strong>
            </div>

            <div className="pt-2 border-t border-luxury-gold-500/10 flex justify-between items-center text-xs">
              <span className="text-luxury-gold-300 font-semibold">🌐 Total OTA Received</span>
              <strong className="font-mono text-luxury-gold-400">₹{Number(aggregates.totalOTAReceived || 0).toLocaleString()}</strong>
            </div>
          </div>

          {/* Ancillary services sales (Col span 3) */}
          <div className="md:col-span-3 space-y-3.5 bg-luxury-brown-950/40 p-4 rounded-xl border border-luxury-gold-500/5">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-luxury-gold-400 font-bold">
              Ancillary Sales Audits
            </h4>

            <div className="flex justify-between items-center text-xs">
              <span className="text-luxury-brown-300">🍽️ Total Food Sales</span>
              <strong className="font-mono text-white">₹{Number(aggregates.totalFoodSales || 0).toLocaleString()}</strong>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-luxury-brown-300">💧 Total Water Bottle Sales</span>
              <strong className="font-mono text-white">₹{Number(aggregates.totalWaterBottleSales || 0).toLocaleString()}</strong>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-luxury-brown-300">🧺 Total Extra Charges</span>
              <strong className="font-mono text-white">₹{Number(aggregates.totalExtraCharges || 0).toLocaleString()}</strong>
            </div>

            <div className="pt-2 border-t border-luxury-gold-500/10 flex justify-between items-center text-xs font-semibold">
              <span className="text-luxury-gold-300">⚡ Total Ancillary Sales</span>
              <strong className="font-mono text-luxury-gold-400">
                ₹{(aggregates.totalFoodSales + aggregates.totalWaterBottleSales + aggregates.totalExtraCharges).toLocaleString()}
              </strong>
            </div>
          </div>

        </div>

        <div className="text-center pt-3 border-t border-luxury-gold-500/15 text-[10px] text-luxury-brown-400 font-mono uppercase tracking-wider leading-none select-none">
          © 2026 DirectStay Multi-Tenant PMS Operations Audit Engine
        </div>

      </div>

      {/* ----------------- FULL REPORT FORMAT (PRINT ONLY) ----------------- */}
      <div className="hidden print:block text-xs space-y-6">
        
        <h2 className="text-xl font-serif text-luxury-brown-950 font-bold border-b pb-2">
          Daily Ledger Register - {activeRange.start} to {activeRange.end}
        </h2>

        <table className="w-full border-collapse border border-gray-300 text-[10px] text-left">
          <thead>
            <tr className="bg-gray-100 font-bold border-b border-gray-400">
              <th className="p-2 border border-gray-300">Booking ID</th>
              <th className="p-2 border border-gray-300">Guest Name</th>
              <th className="p-2 border border-gray-300">Owner</th>
              <th className="p-2 border border-gray-300">Room</th>
              <th className="p-2 border border-gray-300 text-right">Tariff</th>
              <th className="p-2 border border-gray-300 text-right">Extras</th>
              <th className="p-2 border border-gray-300 text-right">Food</th>
              <th className="p-2 border border-gray-300 text-right">Water</th>
              <th className="p-2 border border-gray-300 text-right">Total Bill</th>
              <th className="p-2 border border-gray-300">Payment</th>
              <th className="p-2 border border-gray-300">Type</th>
              <th className="p-2 border border-gray-300 text-right">Paid</th>
              <th className="p-2 border border-gray-300 text-right">Pending</th>
              <th className="p-2 border border-gray-300">Check-In</th>
              <th className="p-2 border border-gray-300">Check-Out</th>
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map(r => (
              <tr key={r.id}>
                <td className="p-2 border border-gray-300 font-mono font-bold">{r.id}</td>
                <td className="p-2 border border-gray-300 font-semibold">{r.guestName}</td>
                <td className="p-2 border border-gray-300 text-gray-600">{r.ownerName}</td>
                <td className="p-2 border border-gray-300 font-mono">Room {r.roomNumber}</td>
                <td className="p-2 border border-gray-300 text-right font-mono">₹{r.bookingAmount}</td>
                <td className="p-2 border border-gray-300 text-right font-mono text-purple-700">₹{r.extraCharges}</td>
                <td className="p-2 border border-gray-300 text-right font-mono text-orange-700">₹{r.foodCharges}</td>
                <td className="p-2 border border-gray-300 text-right font-mono text-sky-700">₹{r.waterCharges}</td>
                <td className="p-2 border border-gray-300 text-right font-mono font-bold">₹{r.totalBill}</td>
                <td className="p-2 border border-gray-300 font-mono">{r.paymentMethod}</td>
                <td className="p-2 border border-gray-300 font-mono">{r.bookingType}</td>
                <td className="p-2 border border-gray-300 text-right font-mono font-bold text-emerald-700">₹{r.paidAmount}</td>
                <td className="p-2 border border-gray-300 text-right font-mono font-bold text-red-700">₹{r.pendingAmount}</td>
                <td className="p-2 border border-gray-300 font-mono">{r.checkInDate}</td>
                <td className="p-2 border border-gray-300 font-mono">{r.checkOutDate}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bottom Aggregates for Print */}
        <div className="border border-gray-400 p-4 bg-gray-50 rounded-lg space-y-4">
          <h3 className="font-bold border-b border-gray-400 pb-1 text-xs uppercase tracking-wider text-gray-800">
            Audit Aggregates Summary
          </h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10px]">
            <div className="flex justify-between">
              <span>Total Business (Tariffs + Extras):</span>
              <strong className="font-mono">₹{aggregates.totalBusiness}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Cash Received:</span>
              <strong className="font-mono">₹{aggregates.totalCashReceived}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total UPI Received:</span>
              <strong className="font-mono">₹{aggregates.totalUPIReceived}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Cards Received:</span>
              <strong className="font-mono">₹{aggregates.totalCardReceived}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Bank Transfers:</span>
              <strong className="font-mono">₹{aggregates.totalBankTransfer}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total OTA Received:</span>
              <strong className="font-mono">₹{aggregates.totalOTAReceived}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-red-700 font-semibold">Total Pending Payment:</span>
              <strong className="font-mono text-red-700">₹{aggregates.totalPendingPayment}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Extra Charges:</span>
              <strong className="font-mono">₹{aggregates.totalExtraCharges}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Food Sales:</span>
              <strong className="font-mono">₹{aggregates.totalFoodSales}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Water Bottle Sales:</span>
              <strong className="font-mono">₹{aggregates.totalWaterBottleSales}</strong>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
