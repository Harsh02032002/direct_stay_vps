import React, { useState } from 'react';
import { 
  InventoryProduct, InventoryCategory, InventorySupplier, 
  InventoryPurchase, InventoryStockMovement, InventoryPurchaseItem 
} from '../types';
import { 
  Package, Layers, Users, ShoppingBag, ArrowDownRight, ArrowUpRight, 
  BarChart2, Plus, Search, Filter, Edit, Trash2, Eye, Check, X, 
  AlertTriangle, CheckCircle, Clock, FileText, Printer, ArrowRight, Building, Phone, GlassWater
} from 'lucide-react';
import { showToast as triggerGlobalToast, ToastSeverity } from '../utils/toast';

interface InventoryViewProps {
  products: InventoryProduct[];
  onUpdateProducts: (products: InventoryProduct[]) => void;
  categories: InventoryCategory[];
  onUpdateCategories: (categories: InventoryCategory[]) => void;
  suppliers: InventorySupplier[];
  onUpdateSuppliers: (suppliers: InventorySupplier[]) => void;
  purchases: InventoryPurchase[];
  onUpdatePurchases: (purchases: InventoryPurchase[]) => void;
  stockMovements: InventoryStockMovement[];
  onUpdateStockMovements: (movements: InventoryStockMovement[]) => void;
  selectedHotelId?: string;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function InventoryView({
  products,
  onUpdateProducts,
  categories,
  onUpdateCategories,
  suppliers,
  onUpdateSuppliers,
  purchases,
  onUpdatePurchases,
  stockMovements,
  onUpdateStockMovements,
  selectedHotelId = 'hotel-1',
  onAddAuditLog
}: InventoryViewProps) {
  // Active Tab: Products, Categories, Suppliers, Purchases, Stock In, Stock Out, Reports
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'suppliers' | 'purchases' | 'stockIn' | 'stockOut' | 'reports'>('products');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string, severity?: ToastSeverity) => {
    triggerGlobalToast(msg, severity);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper to re-calculate product status based on stock & min stock
  const calculateStatus = (current: number, min: number): 'In Stock' | 'Low Stock' | 'Out of Stock' => {
    if (current <= 0) return 'Out of Stock';
    if (current <= min) return 'Low Stock';
    return 'In Stock';
  };

  // Helper to generate next Product Code e.g. PRD-1008
  const generateNextProductCode = () => {
    if (products.length === 0) return 'PRD-1001';
    const numbers = products
      .map(p => {
        const match = p.code.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 1000;
    return `PRD-${maxNum + 1}`;
  };

  // Helper to generate next Purchase Number e.g. PUR-2026-003
  const generateNextPurchaseNumber = () => {
    const year = new Date().getFullYear();
    const count = purchases.length + 1;
    const padded = String(count).padStart(3, '0');
    return `PUR-${year}-${padded}`;
  };

  // -------------------------------------------------------------
  // PRODUCTS STATE & HANDLERS
  // -------------------------------------------------------------
  const getTodayLocalStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getOffsetLocalStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [invDateFilterType, setInvDateFilterType] = useState<'All' | 'Today' | 'Yesterday' | 'Date' | 'This Month' | 'Range'>('All');
  const [invFilterSingleDate, setInvFilterSingleDate] = useState<string>(getTodayLocalStr());
  const [invFilterStartDate, setInvFilterStartDate] = useState<string>(getOffsetLocalStr(-7));
  const [invFilterEndDate, setInvFilterEndDate] = useState<string>(getTodayLocalStr());

  const matchesInvDateFilter = (rawDate?: string) => {
    if (invDateFilterType === 'All') return true;
    const dStr = String(rawDate || '').slice(0, 10);
    const todayStr = getTodayLocalStr();
    if (invDateFilterType === 'Today') return dStr === todayStr;
    if (invDateFilterType === 'Yesterday') return dStr === getOffsetLocalStr(-1);
    if (invDateFilterType === 'Date') return dStr === invFilterSingleDate;
    if (invDateFilterType === 'This Month') return dStr.startsWith(todayStr.slice(0, 7));
    if (invDateFilterType === 'Range') {
      return (!invFilterStartDate || dStr >= invFilterStartDate) && (!invFilterEndDate || dStr <= invFilterEndDate);
    }
    return true;
  };

  const renderInvDateFilterBar = (totalCount: number) => (
    <div className="bg-white p-3.5 rounded-2xl border border-luxury-brown-100 shadow-2xs flex flex-wrap items-center gap-2 text-xs">
      <span className="font-mono font-bold text-luxury-brown-600 uppercase mr-1">Date-Wise Filter:</span>
      {([
        ['All', `All (${totalCount})`],
        ['Today', 'Today'],
        ['Yesterday', 'Yesterday'],
        ['Date', 'Specific Date'],
        ['This Month', 'This Month'],
        ['Range', 'From → To Range']
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setInvDateFilterType(key)}
          className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
            invDateFilterType === key
              ? 'bg-luxury-brown-900 text-white border-luxury-brown-900 shadow-2xs'
              : 'bg-white text-luxury-brown-700 border-luxury-brown-200 hover:bg-luxury-beige-50'
          }`}
        >
          {label}
        </button>
      ))}
      {invDateFilterType === 'Date' && (
        <input
          type="date"
          value={invFilterSingleDate}
          onChange={e => setInvFilterSingleDate(e.target.value)}
          className="px-2.5 py-1 border border-luxury-brown-200 rounded-lg bg-white font-mono text-xs font-bold"
        />
      )}
      {invDateFilterType === 'Range' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="date"
            value={invFilterStartDate}
            onChange={e => setInvFilterStartDate(e.target.value)}
            className="px-2.5 py-1 border border-luxury-brown-200 rounded-lg bg-white font-mono text-xs"
          />
          <span className="text-luxury-brown-500 font-bold">→</span>
          <input
            type="date"
            value={invFilterEndDate}
            onChange={e => setInvFilterEndDate(e.target.value)}
            className="px-2.5 py-1 border border-luxury-brown-200 rounded-lg bg-white font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
  const [prodSearch, setProdSearch] = useState('');
  const [prodCategoryFilter, setProdCategoryFilter] = useState('ALL');
  const [showProdModal, setShowProdModal] = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);

  const [prodName, setProdName] = useState('');
  const [prodCode, setProdCode] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodUnit, setProdUnit] = useState('Pcs');
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodStock, setProdStock] = useState<number>(0);
  const [prodMinStock, setProdMinStock] = useState<number>(10);

  const handleOpenAddProd = () => {
    setEditingProdId(null);
    setProdName('');
    setProdCode(generateNextProductCode());
    setProdCategory(categories[0]?.name || 'Housekeeping & Cleaning');
    setProdUnit('Pcs');
    setProdPrice(0);
    setProdStock(0);
    setProdMinStock(10);
    setShowProdModal(true);
  };

  // Quick Add / Restock Water Bottle product (Point 13)
  const handleQuickAddWaterBottle = () => {
    const existingWater = products.find(p =>
      p.name.toLowerCase().includes('water bottle') ||
      p.name.toLowerCase().includes('mineral water') ||
      p.name.toLowerCase() === 'water' ||
      ((p as any).sku && String((p as any).sku).toUpperCase().includes('WATER'))
    );
    if (existingWater) {
      handleOpenEditProd(existingWater);
      showToast(`Found "${existingWater.name}" in inventory (Current Stock: ${existingWater.currentStock} ${existingWater.unit}). Adjust stock or details.`, 'info');
    } else {
      setEditingProdId(null);
      setProdName('Packaged Drinking Water (1L)');
      setProdCode(generateNextProductCode());
      setProdCategory('Beverages & Mini-Bar');
      setProdUnit('Bottles');
      setProdPrice(15);
      setProdStock(48);
      setProdMinStock(24);
      setShowProdModal(true);
      showToast('Pre-filled Packaged Drinking Water (1L). Click Save to record bottle inventory.', 'info');
    }
  };

  const handleOpenEditProd = (p: InventoryProduct) => {
    setEditingProdId(p.id);
    setProdName(p.name);
    setProdCode(p.code);
    setProdCategory(p.category);
    setProdUnit(p.unit);
    setProdPrice(p.purchasePrice);
    setProdStock(p.currentStock);
    setProdMinStock(p.minimumStock);
    setShowProdModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      showToast('Product name is required', 'warning');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const status = calculateStatus(prodStock, prodMinStock);

    if (editingProdId) {
      const updated = products.map(p => p.id === editingProdId ? {
        ...p,
        name: prodName.trim(),
        code: prodCode.trim() || p.code,
        category: prodCategory,
        unit: prodUnit,
        purchasePrice: Number(prodPrice),
        currentStock: Number(prodStock),
        minimumStock: Number(prodMinStock),
        status,
        lastUpdated: todayStr
      } : p);
      onUpdateProducts(updated);
      onAddAuditLog?.(
        'Inventory Product Updated',
        `Updated inventory product "${prodName.trim()}" (${prodCode.trim()}) — Stock: ${prodStock} ${prodUnit}, Price: ₹${prodPrice}.`
      );
      showToast(`✓ Product "${prodName}" updated successfully.`, 'success');
    } else {
      const newProd: InventoryProduct = {
        id: `prod-${Date.now()}`,
        name: prodName.trim(),
        code: prodCode.trim() || generateNextProductCode(),
        category: prodCategory || 'General',
        unit: prodUnit || 'Pcs',
        purchasePrice: Number(prodPrice),
        currentStock: Number(prodStock),
        minimumStock: Number(prodMinStock),
        status,
        lastUpdated: todayStr,
        hotelId: selectedHotelId
      };
      onUpdateProducts([newProd, ...products]);

      // Log initial stock movement if > 0
      if (prodStock > 0) {
        const initMov: InventoryStockMovement = {
          id: `mov-${Date.now()}`,
          type: 'IN',
          productId: newProd.id,
          productName: newProd.name,
          productCode: newProd.code,
          quantity: prodStock,
          date: todayStr,
          reason: 'Initial Opening Stock',
          notes: 'Added upon product creation',
          hotelId: selectedHotelId
        };
        onUpdateStockMovements([initMov, ...stockMovements]);
      }

      onAddAuditLog?.(
        'Inventory Product Added',
        `Added inventory product "${newProd.name}" (${newProd.code}) in ${newProd.category} with opening stock ${newProd.currentStock} ${newProd.unit}.`
      );
      showToast(`✓ New product "${prodName}" added with code ${newProd.code}.`, 'success');
    }

    setShowProdModal(false);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete product "${name}"?`)) return;
    const updated = products.filter(p => p.id !== id);
    onUpdateProducts(updated);
    onAddAuditLog?.(
      'Inventory Product Deleted',
      `Deleted inventory product "${name}" (ID: ${id}).`
    );
    showToast(`✓ Product "${name}" deleted.`, 'info');
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(prodSearch.toLowerCase()) || 
      p.code.toLowerCase().includes(prodSearch.toLowerCase());
    const matchesCat = prodCategoryFilter === 'ALL' || p.category === prodCategoryFilter;
    return matchesQuery && matchesCat;
  });


  // -------------------------------------------------------------
  // CATEGORIES STATE & HANDLERS
  // -------------------------------------------------------------
  const [catSearch, setCatSearch] = useState('');
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const handleOpenAddCat = () => {
    setEditingCatId(null);
    setCatName('');
    setCatDesc('');
    setShowCatModal(true);
  };

  const handleOpenEditCat = (c: InventoryCategory) => {
    setEditingCatId(c.id);
    setCatName(c.name);
    setCatDesc(c.description || '');
    setShowCatModal(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast('Category Name is required', 'warning');
      return;
    }

    if (editingCatId) {
      const updated = categories.map(c => c.id === editingCatId ? {
        ...c,
        name: catName.trim(),
        description: catDesc.trim()
      } : c);
      onUpdateCategories(updated);
      onAddAuditLog?.(
        'Inventory Category Updated',
        `Updated inventory category "${catName.trim()}".`
      );
      showToast(`✓ Category "${catName}" updated.`, 'success');
    } else {
      const newCat: InventoryCategory = {
        id: `cat-${Date.now()}`,
        name: catName.trim(),
        description: catDesc.trim()
      };
      onUpdateCategories([...categories, newCat]);
      onAddAuditLog?.(
        'Inventory Category Added',
        `Added inventory category "${newCat.name}".`
      );
      showToast(`✓ New category "${catName}" added.`, 'success');
    }
    setShowCatModal(false);
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;
    const updated = categories.filter(c => c.id !== id);
    onUpdateCategories(updated);
    onAddAuditLog?.(
      'Inventory Category Deleted',
      `Deleted inventory category "${name}" (ID: ${id}).`
    );
    showToast(`✓ Category "${name}" deleted.`, 'info');
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(catSearch.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(catSearch.toLowerCase()))
  );


  // -------------------------------------------------------------
  // SUPPLIERS STATE & HANDLERS
  // -------------------------------------------------------------
  const [supSearch, setSupSearch] = useState('');
  const [showSupModal, setShowSupModal] = useState(false);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [supMobile, setSupMobile] = useState('');
  const [supGst, setSupGst] = useState('');
  const [supAddress, setSupAddress] = useState('');

  const handleOpenAddSup = () => {
    setEditingSupId(null);
    setSupName('');
    setSupMobile('');
    setSupGst('');
    setSupAddress('');
    setShowSupModal(true);
  };

  const handleOpenEditSup = (s: InventorySupplier) => {
    setEditingSupId(s.id);
    setSupName(s.name);
    setSupMobile(s.mobile);
    setSupGst(s.gst);
    setSupAddress(s.address);
    setShowSupModal(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      showToast('Supplier Name is required', 'warning');
      return;
    }

    if (editingSupId) {
      const updated = suppliers.map(s => s.id === editingSupId ? {
        ...s,
        name: supName.trim(),
        mobile: supMobile.trim(),
        gst: supGst.trim(),
        address: supAddress.trim()
      } : s);
      onUpdateSuppliers(updated);
      onAddAuditLog?.(
        'Inventory Supplier Updated',
        `Updated inventory supplier "${supName.trim()}" (GST: ${supGst.trim() || 'N/A'}).`
      );
      showToast(`✓ Supplier "${supName}" updated.`, 'success');
    } else {
      const newSup: InventorySupplier = {
        id: `sup-${Date.now()}`,
        name: supName.trim(),
        mobile: supMobile.trim(),
        gst: supGst.trim(),
        address: supAddress.trim()
      };
      onUpdateSuppliers([...suppliers, newSup]);
      onAddAuditLog?.(
        'Inventory Supplier Added',
        `Added inventory supplier "${newSup.name}" (GST: ${newSup.gst || 'N/A'}).`
      );
      showToast(`✓ New supplier "${supName}" added.`, 'success');
    }
    setShowSupModal(false);
  };

  const handleDeleteSupplier = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete supplier "${name}"?`)) return;
    const updated = suppliers.filter(s => s.id !== id);
    onUpdateSuppliers(updated);
    onAddAuditLog?.(
      'Inventory Supplier Deleted',
      `Deleted inventory supplier "${name}" (ID: ${id}).`
    );
    showToast(`✓ Supplier "${name}" deleted.`, 'info');
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supSearch.toLowerCase()) ||
    s.mobile.includes(supSearch) ||
    s.gst.toLowerCase().includes(supSearch.toLowerCase())
  );


  // -------------------------------------------------------------
  // PURCHASES STATE & HANDLERS (AUTOMATICALLY INCREASES STOCK)
  // -------------------------------------------------------------
  const [purSearch, setPurSearch] = useState('');
  const [showPurModal, setShowPurModal] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<InventoryPurchase | null>(null);

  const [purSupplierId, setPurSupplierId] = useState('');
  const [purDate, setPurDate] = useState(new Date().toISOString().split('T')[0]);
  const [purNotes, setPurNotes] = useState('');
  const [purItems, setPurItems] = useState<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>([{ productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.purchasePrice || 0 }]);

  const handleOpenAddPurchase = () => {
    setPurSupplierId(suppliers[0]?.id || '');
    setPurDate(new Date().toISOString().split('T')[0]);
    setPurNotes('');
    setPurItems([{ 
      productId: products[0]?.id || '', 
      quantity: 1, 
      unitPrice: products[0]?.purchasePrice || 0 
    }]);
    setShowPurModal(true);
  };

  const handleAddPurItemRow = () => {
    setPurItems([
      ...purItems,
      { productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.purchasePrice || 0 }
    ]);
  };

  const handleRemovePurItemRow = (index: number) => {
    if (purItems.length === 1) return;
    setPurItems(purItems.filter((_, i) => i !== index));
  };

  const handlePurItemProductChange = (index: number, pId: string) => {
    const selProd = products.find(p => p.id === pId);
    const updated = [...purItems];
    updated[index] = {
      productId: pId,
      quantity: updated[index].quantity || 1,
      unitPrice: selProd ? selProd.purchasePrice : 0
    };
    setPurItems(updated);
  };

  const handlePurItemQtyChange = (index: number, qty: number) => {
    const updated = [...purItems];
    updated[index].quantity = qty < 1 ? 1 : qty;
    setPurItems(updated);
  };

  const handlePurItemPriceChange = (index: number, price: number) => {
    const updated = [...purItems];
    updated[index].unitPrice = price < 0 ? 0 : price;
    setPurItems(updated);
  };

  const calculatePurGrandTotal = () => {
    return purItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purSupplierId) {
      showToast('Please select a supplier', 'warning');
      return;
    }
    if (purItems.length === 0) {
      showToast('Please add at least one product item to the purchase order', 'warning');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === purSupplierId);
    const supplierName = supplierObj ? supplierObj.name : 'Unknown Supplier';
    const purchaseNum = generateNextPurchaseNumber();

    // Map Purchase Items
    const mappedItems: InventoryPurchaseItem[] = purItems.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        productName: prod ? prod.name : 'Product',
        productCode: prod ? prod.code : 'PRD',
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.quantity) * Number(item.unitPrice)
      };
    });

    const grandTotal = mappedItems.reduce((sum, i) => sum + i.totalPrice, 0);

    const newPurchase: InventoryPurchase = {
      id: `pur-${Date.now()}`,
      purchaseNumber: purchaseNum,
      supplierId: purSupplierId,
      supplierName,
      date: purDate,
      items: mappedItems,
      grandTotal,
      notes: purNotes.trim(),
      status: 'Completed',
      hotelId: selectedHotelId
    };

    // CRITICAL REQUIREMENT: Purchases automatically increase stock!
    let updatedProducts = [...products];
    let newMovements: InventoryStockMovement[] = [];

    mappedItems.forEach(item => {
      const existingProdIndex = updatedProducts.findIndex(p => p.id === item.productId);
      if (existingProdIndex !== -1) {
        const currentP = updatedProducts[existingProdIndex];
        const newStock = currentP.currentStock + item.quantity;
        const newStatus = calculateStatus(newStock, currentP.minimumStock);

        updatedProducts[existingProdIndex] = {
          ...currentP,
          currentStock: newStock,
          purchasePrice: item.unitPrice > 0 ? item.unitPrice : currentP.purchasePrice,
          status: newStatus,
          lastUpdated: purDate
        };

        // Create Stock Movement IN
        newMovements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'IN',
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          date: purDate,
          reason: 'Purchase Order',
          refNumber: purchaseNum,
          supplierId: purSupplierId,
          notes: `Automatic stock increase via purchase order ${purchaseNum}`,
          hotelId: selectedHotelId
        });
      }
    });

    onUpdateProducts(updatedProducts);
    onUpdatePurchases([newPurchase, ...purchases]);
    onUpdateStockMovements([...newMovements, ...stockMovements]);
    onAddAuditLog?.(
      'Inventory Purchase Created',
      `Created purchase order ${purchaseNum} from "${supplierName}" for ₹${grandTotal.toLocaleString()} (${mappedItems.length} item(s)).`
    );

    setShowPurModal(false);
    showToast(`✓ Purchase order ${purchaseNum} created! Stock increased for ${mappedItems.length} products automatically.`, 'success');
  };

  const filteredPurchases = purchases.filter(p => {
    const matchText =
      p.purchaseNumber.toLowerCase().includes(purSearch.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(purSearch.toLowerCase()) ||
      (p.notes && p.notes.toLowerCase().includes(purSearch.toLowerCase()));
    if (!matchText) return false;
    return matchesInvDateFilter(p.date);
  });


  // -------------------------------------------------------------
  // STOCK IN STATE & HANDLERS
  // -------------------------------------------------------------
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [inProdId, setInProdId] = useState(products[0]?.id || '');
  const [inQty, setInQty] = useState<number>(1);
  const [inDate, setInDate] = useState(new Date().toISOString().split('T')[0]);
  const [inReason, setInReason] = useState('Manual Stock In');
  const [inNotes, setInNotes] = useState('');

  const handleOpenStockIn = () => {
    setInProdId(products[0]?.id || '');
    setInQty(1);
    setInDate(new Date().toISOString().split('T')[0]);
    setInReason('Manual Stock In');
    setInNotes('');
    setShowStockInModal(true);
  };

  const handleSaveStockIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inProdId) {
      showToast('Please select a product', 'warning');
      return;
    }
    if (inQty <= 0) {
      showToast('Quantity must be greater than 0', 'warning');
      return;
    }

    const prod = products.find(p => p.id === inProdId);
    if (!prod) return;

    const newStock = prod.currentStock + Number(inQty);
    const newStatus = calculateStatus(newStock, prod.minimumStock);

    const updatedProducts = products.map(p => p.id === inProdId ? {
      ...p,
      currentStock: newStock,
      status: newStatus,
      lastUpdated: inDate
    } : p);

    const newMov: InventoryStockMovement = {
      id: `mov-${Date.now()}`,
      type: 'IN',
      productId: prod.id,
      productName: prod.name,
      productCode: prod.code,
      quantity: Number(inQty),
      date: inDate,
      reason: inReason,
      notes: inNotes.trim() || 'Manual stock in entry',
      hotelId: selectedHotelId
    };

    onUpdateProducts(updatedProducts);
    onUpdateStockMovements([newMov, ...stockMovements]);
    onAddAuditLog?.(
      'Inventory Stock In',
      `Stock In (+${inQty} ${prod.unit}) for "${prod.name}" (${prod.code}) — Reason: ${inReason}. New Stock: ${newStock} ${prod.unit}.`
    );
    setShowStockInModal(false);
    showToast(`✓ Stock In recorded! Added ${inQty} ${prod.unit} of "${prod.name}".`, 'success');
  };

  const allStockInCount = stockMovements.filter(m => m.type === 'IN').length;
  const stockInMovements = stockMovements.filter(m => m.type === 'IN' && matchesInvDateFilter(m.date));


  // -------------------------------------------------------------
  // STOCK OUT STATE & HANDLERS
  // -------------------------------------------------------------
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [outProdId, setOutProdId] = useState(products[0]?.id || '');
  const [outQty, setOutQty] = useState<number>(1);
  const [outDate, setOutDate] = useState(new Date().toISOString().split('T')[0]);
  const [outReason, setOutReason] = useState('Housekeeping Usage');
  const [outNotes, setOutNotes] = useState('');

  const handleOpenStockOut = () => {
    setOutProdId(products[0]?.id || '');
    setOutQty(1);
    setOutDate(new Date().toISOString().split('T')[0]);
    setOutReason('Housekeeping Usage');
    setOutNotes('');
    setShowStockOutModal(true);
  };

  const handleSaveStockOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outProdId) {
      showToast('Please select a product', 'warning');
      return;
    }
    if (outQty <= 0) {
      showToast('Quantity must be greater than 0', 'warning');
      return;
    }

    const prod = products.find(p => p.id === outProdId);
    if (!prod) return;

    if (outQty > prod.currentStock) {
      showToast(`Cannot issue ${outQty} ${prod.unit}. Only ${prod.currentStock} ${prod.unit} available in current stock!`, 'error');
      return;
    }

    const newStock = prod.currentStock - Number(outQty);
    const newStatus = calculateStatus(newStock, prod.minimumStock);

    const updatedProducts = products.map(p => p.id === outProdId ? {
      ...p,
      currentStock: newStock,
      status: newStatus,
      lastUpdated: outDate
    } : p);

    const newMov: InventoryStockMovement = {
      id: `mov-${Date.now()}`,
      type: 'OUT',
      productId: prod.id,
      productName: prod.name,
      productCode: prod.code,
      quantity: Number(outQty),
      date: outDate,
      reason: outReason,
      notes: outNotes.trim() || 'Manual stock out entry',
      hotelId: selectedHotelId
    };

    onUpdateProducts(updatedProducts);
    onUpdateStockMovements([newMov, ...stockMovements]);
    onAddAuditLog?.(
      'Inventory Stock Out',
      `Stock Out (-${outQty} ${prod.unit}) for "${prod.name}" (${prod.code}) — Reason: ${outReason}. Remaining Stock: ${newStock} ${prod.unit}.`
    );
    setShowStockOutModal(false);
    showToast(`✓ Stock Out recorded! Issued ${outQty} ${prod.unit} of "${prod.name}".`);
  };

  const allStockOutCount = stockMovements.filter(m => m.type === 'OUT').length;
  const stockOutMovements = stockMovements.filter(m => m.type === 'OUT' && matchesInvDateFilter(m.date));


  // -------------------------------------------------------------
  // REPORTS COMPUTATIONS
  // -------------------------------------------------------------
  const totalStockValue = products.reduce((sum, p) => sum + (p.currentStock * p.purchasePrice), 0);
  const totalProductsCount = products.length;
  const lowStockCount = products.filter(p => p.status === 'Low Stock').length;
  const outOfStockCount = products.filter(p => p.status === 'Out of Stock').length;
  const inStockCount = products.filter(p => p.status === 'In Stock').length;

  const categoryValuation = categories.map(cat => {
    const catProds = products.filter(p => p.category === cat.name);
    const count = catProds.length;
    const value = catProds.reduce((sum, p) => sum + (p.currentStock * p.purchasePrice), 0);
    return { name: cat.name, count, value };
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-900 text-emerald-100 px-4 py-3 rounded-xl shadow-lg border border-emerald-500/30 flex items-center justify-between text-xs font-semibold animate-fade-in my-2">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-300 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-luxury-brown-950 via-luxury-brown-900 to-black text-white p-6 rounded-2xl border border-luxury-gold-500/20 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-luxury-gold-500/20 text-luxury-gold-300 border border-luxury-gold-500/20 text-[10px] font-mono uppercase font-bold tracking-wider">
            <Package className="w-3.5 h-3.5 text-luxury-gold-400" /> Standalone Inventory & Stock Engine
          </div>
          <h1 className="text-2xl font-serif font-bold text-white">Inventory Store Management</h1>
          <p className="text-xs text-luxury-brown-200 max-w-2xl">
            Track hotel stock, manage suppliers, process automatic stock-increasing purchase vouchers, issue stock out, and view valuation audits.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAddPurchase}
            className="px-3.5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" /> + Purchase Stock
          </button>
          <button
            onClick={handleOpenStockOut}
            className="px-3 py-2 bg-luxury-brown-800 hover:bg-luxury-brown-700 text-luxury-gold-300 font-bold text-xs rounded-xl border border-luxury-gold-500/30 cursor-pointer transition-all flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-400" /> Stock Out
          </button>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="bg-white p-2 rounded-2xl border border-luxury-brown-100 shadow-sm flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
            activeTab === 'products'
              ? 'bg-luxury-brown-900 text-luxury-gold-300 shadow-sm'
              : 'text-luxury-brown-600 hover:bg-luxury-beige-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Products</span>
          <span className={`min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full text-xs font-sans font-extrabold ${
            activeTab === 'products'
              ? 'bg-white !text-[#17120F]'
              : 'bg-[#FBF4E0] !text-[#8B691E] border border-[#C49A3A]/40'
          }`}>
            {products.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-luxury-brown-900 text-luxury-gold-300 shadow-sm'
              : 'text-luxury-brown-600 hover:bg-luxury-beige-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Categories</span>
          <span className={`min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full text-xs font-sans font-extrabold ${
            activeTab === 'categories'
              ? 'bg-white !text-[#17120F]'
              : 'bg-[#FBF4E0] !text-[#8B691E] border border-[#C49A3A]/40'
          }`}>
            {categories.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
            activeTab === 'suppliers'
              ? 'bg-luxury-brown-900 text-luxury-gold-300 shadow-sm'
              : 'text-luxury-brown-600 hover:bg-luxury-beige-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Suppliers</span>
          <span className={`min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full text-xs font-sans font-extrabold ${
            activeTab === 'suppliers'
              ? 'bg-white !text-[#17120F]'
              : 'bg-[#FBF4E0] !text-[#8B691E] border border-[#C49A3A]/40'
          }`}>
            {suppliers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
            activeTab === 'purchases'
              ? 'bg-luxury-brown-900 text-luxury-gold-300 shadow-sm'
              : 'text-luxury-brown-600 hover:bg-luxury-beige-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Purchases</span>
          <span className={`min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full text-xs font-sans font-extrabold ${
            activeTab === 'purchases'
              ? 'bg-white !text-[#17120F]'
              : 'bg-[#FBF4E0] !text-[#8B691E] border border-[#C49A3A]/40'
          }`}>
            {purchases.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('stockIn')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
            activeTab === 'stockIn'
              ? 'bg-luxury-brown-900 text-luxury-gold-300 shadow-sm'
              : 'text-luxury-brown-600 hover:bg-luxury-beige-100'
          }`}
        >
          <ArrowDownRight className="w-4 h-4 text-emerald-400" />
          <span>Stock In</span>
        </button>

        <button
          onClick={() => setActiveTab('stockOut')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
            activeTab === 'stockOut'
              ? 'bg-luxury-brown-900 text-luxury-gold-300 shadow-sm'
              : 'text-luxury-brown-600 hover:bg-luxury-beige-100'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 text-rose-400" />
          <span>Stock Out</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-luxury-brown-900 text-luxury-gold-300 shadow-sm'
              : 'text-luxury-brown-600 hover:bg-luxury-beige-100'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-luxury-gold-400" />
          <span>Reports</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. PRODUCTS TAB */}
      {/* ========================================================= */}
      {activeTab === 'products' && (
        <div className="space-y-4 animate-fade-in">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-luxury-brown-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-luxury-brown-400" />
                <input
                  type="text"
                  placeholder="Search product name or code..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={prodCategoryFilter}
                onChange={(e) => setProdCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs font-medium focus:outline-none focus:border-luxury-gold-500"
              >
                <option value="ALL">All Categories ({products.length})</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleQuickAddWaterBottle}
                className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
                title="Quick Add or Restock Packaged Drinking Water Bottles (Point 13)"
              >
                <GlassWater className="w-4 h-4" /> + Water Bottle Stock (1L)
              </button>
              <button
                onClick={handleOpenAddProd}
                className="w-full sm:w-auto px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-luxury-brown-900 text-luxury-gold-300 text-[11px] font-mono uppercase tracking-wider">
                    <th className="p-4">Code</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Unit</th>
                    <th className="p-4 text-right">Purchase Price</th>
                    <th className="p-4 text-center">Current Stock</th>
                    <th className="p-4 text-center">Min Stock</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100 text-xs text-luxury-brown-900">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-luxury-brown-400 font-serif">
                        No products found. Click "Add Product" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-luxury-beige-50/60 transition-colors">
                        <td className="p-4 font-mono font-bold text-luxury-gold-800 bg-luxury-beige-100/50 rounded-lg">
                          {p.code}
                        </td>
                        <td className="p-4 font-serif font-bold text-luxury-brown-950">
                          {p.name}
                        </td>
                        <td className="p-4 text-luxury-brown-600">
                          <span className="px-2.5 py-1 bg-luxury-beige-100 rounded-md text-[11px] font-medium border border-luxury-brown-200">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-4 text-luxury-brown-500 font-mono">
                          {p.unit}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-luxury-brown-900">
                          ₹{Number(p.purchasePrice || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-sm">
                          <span className={p.currentStock <= p.minimumStock ? 'text-rose-600 font-black' : 'text-emerald-800'}>
                            {p.currentStock} {p.unit}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono text-luxury-brown-500">
                          {p.minimumStock}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border uppercase tracking-wider ${
                            p.status === 'In Stock'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : p.status === 'Low Stock'
                              ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1">
                          <button
                            onClick={() => handleOpenEditProd(p)}
                            className="p-1.5 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-800 rounded-lg cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CATEGORIES TAB */}
      {/* ========================================================= */}
      {activeTab === 'categories' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-luxury-brown-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-luxury-brown-400" />
              <input
                type="text"
                placeholder="Search category name..."
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500"
              />
            </div>

            <button
              onClick={handleOpenAddCat}
              className="w-full sm:w-auto px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategories.map(cat => {
              const productCount = products.filter(p => p.category === cat.name).length;
              return (
                <div key={cat.id} className="bg-white p-5 rounded-2xl border border-luxury-brown-100 shadow-sm flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="p-2 bg-luxury-beige-100 text-luxury-gold-700 rounded-xl">
                        <Layers className="w-5 h-5" />
                      </span>
                      <span className="px-2.5 py-1 bg-luxury-brown-900 text-luxury-gold-300 rounded-lg text-[10px] font-mono font-bold">
                        {productCount} Products
                      </span>
                    </div>
                    <h3 className="font-serif font-bold text-base text-luxury-brown-950">{cat.name}</h3>
                    <p className="text-xs text-luxury-brown-600 line-clamp-2 leading-relaxed">
                      {cat.description || 'No description available for this category.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-luxury-brown-100 flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenEditCat(cat)}
                      className="px-3 py-1.5 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-800 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SUPPLIERS TAB */}
      {/* ========================================================= */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-luxury-brown-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-luxury-brown-400" />
              <input
                type="text"
                placeholder="Search supplier name, GST or mobile..."
                value={supSearch}
                onChange={(e) => setSupSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500"
              />
            </div>

            <button
              onClick={handleOpenAddSup}
              className="w-full sm:w-auto px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map(sup => {
              const supPurchases = purchases.filter(p => p.supplierId === sup.id);
              const totalPurchasedVal = supPurchases.reduce((acc, p) => acc + p.grandTotal, 0);

              return (
                <div key={sup.id} className="bg-white p-5 rounded-2xl border border-luxury-brown-100 shadow-sm space-y-4 hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h3 className="font-serif font-bold text-base text-luxury-brown-950">{sup.name}</h3>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-luxury-gold-50 text-luxury-gold-900 border border-luxury-gold-300 text-[10px] font-mono font-bold">
                          GST: {sup.gst || 'N/A'}
                        </span>
                      </div>
                      <span className="p-2 bg-luxury-beige-100 text-luxury-brown-800 rounded-xl">
                        <Building className="w-5 h-5" />
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-luxury-brown-700">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-luxury-gold-600" />
                        <span className="font-mono">{sup.mobile || 'No Mobile Provided'}</span>
                      </div>
                      <div className="text-luxury-brown-500 text-[11px] leading-relaxed">
                        {sup.address || 'No Address Recorded'}
                      </div>
                    </div>

                    <div className="p-3 bg-luxury-beige-50 rounded-xl border border-luxury-brown-100 flex items-center justify-between text-xs font-mono">
                      <span className="text-luxury-brown-500">Total Purchases:</span>
                      <span className="font-bold text-luxury-brown-950">₹{totalPurchasedVal.toLocaleString('en-IN')} ({supPurchases.length} orders)</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-luxury-brown-100 flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenEditSup(sup)}
                      className="px-3 py-1.5 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-800 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. PURCHASES TAB (AUTOMATICALLY INCREASES STOCK) */}
      {/* ========================================================= */}
      {activeTab === 'purchases' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-luxury-brown-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-luxury-brown-400" />
              <input
                type="text"
                placeholder="Search purchase number or supplier..."
                value={purSearch}
                onChange={(e) => setPurSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500"
              />
            </div>

            <button
              onClick={handleOpenAddPurchase}
              className="w-full sm:w-auto px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Purchase Order (+Increases Stock)
            </button>
          </div>

          {renderInvDateFilterBar(purchases.length)}

          <div className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-luxury-brown-900 text-luxury-gold-300 text-[11px] font-mono uppercase tracking-wider">
                    <th className="p-4">Purchase No</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-center">Items Count</th>
                    <th className="p-4 text-right">Grand Total</th>
                    <th className="p-4 text-center">Stock Update</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100 text-xs text-luxury-brown-900">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-luxury-brown-400 font-serif">
                        No purchase orders recorded yet. Click "New Purchase Order" to add stock.
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map(pur => (
                      <tr key={pur.id} className="hover:bg-luxury-beige-50/60 transition-colors">
                        <td className="p-4 font-mono font-bold text-luxury-gold-800 bg-luxury-beige-100/50 rounded-lg">
                          {pur.purchaseNumber}
                        </td>
                        <td className="p-4 font-serif font-bold text-luxury-brown-950">
                          {pur.supplierName}
                        </td>
                        <td className="p-4 text-luxury-brown-600 font-mono">
                          {pur.date}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-luxury-brown-800">
                          {pur.items.length} items
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-luxury-brown-950">
                          ₹{Number(pur.grandTotal || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-mono font-bold">
                            <Check className="w-3 h-3 text-emerald-600" /> Stock Increased
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setViewingPurchase(pur)}
                            className="px-3 py-1.5 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-900 font-bold rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-luxury-gold-600" /> View Voucher
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. STOCK IN TAB */}
      {/* ========================================================= */}
      {activeTab === 'stockIn' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-luxury-brown-100 shadow-sm flex items-center justify-between gap-4">
            <div>
              <h3 className="font-serif font-bold text-base text-luxury-brown-950">Stock In Log (+Additions)</h3>
              <p className="text-xs text-luxury-brown-500">Record manual stock adjustments, returns from rooms, or opening balances.</p>
            </div>
            <button
              onClick={handleOpenStockIn}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5"
            >
              <ArrowDownRight className="w-4 h-4 text-emerald-300" /> Record Manual Stock In
            </button>
          </div>

          {renderInvDateFilterBar(allStockInCount)}

          <div className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-luxury-brown-900 text-luxury-gold-300 text-[11px] font-mono uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Product Code & Name</th>
                    <th className="p-4 text-center">Quantity Added</th>
                    <th className="p-4">Reason / Type</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100 text-xs text-luxury-brown-900">
                  {stockInMovements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-luxury-brown-400 font-serif">
                        No Stock In entries recorded.
                      </td>
                    </tr>
                  ) : (
                    stockInMovements.map(m => (
                      <tr key={m.id} className="hover:bg-luxury-beige-50/60 transition-colors">
                        <td className="p-4 font-mono text-luxury-brown-600">{m.date}</td>
                        <td className="p-4 font-serif font-bold text-luxury-brown-950">
                          <span className="font-mono text-luxury-gold-800 mr-2">[{m.productCode}]</span>
                          {m.productName}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-emerald-800 text-sm">
                          +{m.quantity}
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-medium">
                            {m.reason}
                          </span>
                        </td>
                        <td className="p-4 text-luxury-brown-500 font-sans italic">{m.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. STOCK OUT TAB */}
      {/* ========================================================= */}
      {activeTab === 'stockOut' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-luxury-brown-100 shadow-sm flex items-center justify-between gap-4">
            <div>
              <h3 className="font-serif font-bold text-base text-luxury-brown-950">Stock Out Log (-Issues & Usage)</h3>
              <p className="text-xs text-luxury-brown-500">Record stock issued for housekeeping, room amenities, kitchen, or damaged goods.</p>
            </div>
            <button
              onClick={handleOpenStockOut}
              className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-4 h-4 text-rose-300" /> Record Stock Out
            </button>
          </div>

          {renderInvDateFilterBar(allStockOutCount)}

          <div className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-luxury-brown-900 text-luxury-gold-300 text-[11px] font-mono uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Product Code & Name</th>
                    <th className="p-4 text-center">Quantity Issued</th>
                    <th className="p-4">Reason / Usage</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100 text-xs text-luxury-brown-900">
                  {stockOutMovements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-luxury-brown-400 font-serif">
                        No Stock Out entries recorded yet. Click "Record Stock Out" to deduct stock.
                      </td>
                    </tr>
                  ) : (
                    stockOutMovements.map(m => (
                      <tr key={m.id} className="hover:bg-luxury-beige-50/60 transition-colors">
                        <td className="p-4 font-mono text-luxury-brown-600">{m.date}</td>
                        <td className="p-4 font-serif font-bold text-luxury-brown-950">
                          <span className="font-mono text-luxury-gold-800 mr-2">[{m.productCode}]</span>
                          {m.productName}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-rose-700 text-sm">
                          -{m.quantity}
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-medium">
                            {m.reason}
                          </span>
                        </td>
                        <td className="p-4 text-luxury-brown-500 font-sans italic">{m.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. REPORTS TAB */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-luxury-brown-100 shadow-sm space-y-1">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-400 tracking-wider font-bold">Total Stock Value</span>
              <div className="text-2xl font-serif font-bold text-luxury-brown-950">
                ₹{totalStockValue.toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-luxury-brown-500 font-mono">Current Asset Valuation</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-luxury-brown-100 shadow-sm space-y-1">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-400 tracking-wider font-bold">Total Products</span>
              <div className="text-2xl font-serif font-bold text-luxury-brown-950">
                {totalProductsCount}
              </div>
              <p className="text-[11px] text-emerald-700 font-mono">{inStockCount} In Stock</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm space-y-1">
              <span className="text-[10px] font-mono uppercase text-amber-800 tracking-wider font-bold">Low Stock Alert</span>
              <div className="text-2xl font-serif font-bold text-amber-900">
                {lowStockCount}
              </div>
              <p className="text-[11px] text-amber-700 font-mono">Needs Restocking Soon</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-sm space-y-1">
              <span className="text-[10px] font-mono uppercase text-rose-800 tracking-wider font-bold">Out of Stock</span>
              <div className="text-2xl font-serif font-bold text-rose-900">
                {outOfStockCount}
              </div>
              <p className="text-[11px] text-rose-700 font-mono">Zero Quantity Available</p>
            </div>
          </div>

          {/* Category Valuation Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-luxury-brown-100 shadow-sm space-y-4">
            <h3 className="font-serif font-bold text-lg text-luxury-brown-950">Category Stock Valuation Audit</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-luxury-brown-900 text-luxury-gold-300 text-[11px] font-mono uppercase tracking-wider">
                    <th className="p-3.5">Category Name</th>
                    <th className="p-3.5 text-center">Products Count</th>
                    <th className="p-3.5 text-right">Total Category Value</th>
                    <th className="p-3.5 text-right">% Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100 text-xs">
                  {categoryValuation.map(cat => {
                    const percentage = totalStockValue > 0 ? ((cat.value / totalStockValue) * 100).toFixed(1) : '0';
                    return (
                      <tr key={cat.name} className="hover:bg-luxury-beige-50/60">
                        <td className="p-3.5 font-serif font-bold text-luxury-brown-950">{cat.name}</td>
                        <td className="p-3.5 text-center font-mono text-luxury-brown-700">{cat.count} items</td>
                        <td className="p-3.5 text-right font-mono font-bold text-luxury-brown-900">
                          ₹{Number(cat.value || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-luxury-gold-800">
                          {percentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low / Out of Stock Actionable List */}
          {(lowStockCount > 0 || outOfStockCount > 0) && (
            <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif font-bold text-base">Restock Required Alert List</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {products.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock').map(p => (
                  <div key={p.id} className="p-3.5 bg-luxury-beige-50 rounded-xl border border-luxury-brown-200 flex justify-between items-center">
                    <div>
                      <span className="font-serif font-bold text-xs text-luxury-brown-950 block">{p.name}</span>
                      <span className="font-mono text-[10px] text-luxury-brown-500">
                        Code: {p.code} | Min Stock: {p.minimumStock}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      p.status === 'Out of Stock' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.currentStock} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT PRODUCT */}
      {/* ========================================================= */}
      {showProdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-base">
                  {editingProdId ? 'Edit Product Details' : 'Add New Product'}
                </h3>
              </div>
              <button onClick={() => setShowProdModal(false)} className="p-1 hover:bg-luxury-brown-800 rounded text-luxury-brown-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-sky-50 border border-sky-200">
                <span className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5">
                  <GlassWater className="w-3.5 h-3.5 text-sky-600" />
                  Quick Preset (Point 13):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setProdName('Packaged Drinking Water (1L)');
                    setProdCategory('Beverages & Mini-Bar');
                    setProdUnit('Bottles');
                    setProdPrice(15);
                    setProdStock(48);
                    setProdMinStock(24);
                  }}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                >
                  💧 Fill Water Bottle (1L) Stock
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Product Code (Auto)</label>
                  <input
                    type="text"
                    required
                    value={prodCode}
                    onChange={(e) => setProdCode(e.target.value)}
                    className="w-full px-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Category *</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Luxury Bath Towel 600 GSM"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500 font-serif font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Unit *</label>
                  <select
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Packet">Packet</option>
                    <option value="Kg">Kg</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Can">Can</option>
                    <option value="Box">Box</option>
                    <option value="Set">Set</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Rolls">Rolls</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Purchase Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Min Stock Alert</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Initial Current Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={prodStock}
                  onChange={(e) => setProdStock(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500 font-bold text-sm"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setShowProdModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-xl shadow"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT CATEGORY */}
      {/* ========================================================= */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-base">
                  {editingCatId ? 'Edit Category' : 'Add New Category'}
                </h3>
              </div>
              <button onClick={() => setShowCatModal(false)} className="p-1 hover:bg-luxury-brown-800 rounded text-luxury-brown-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Linen & Bedding"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500 font-serif font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief summary of items in this category..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-xl shadow"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL 3: ADD / EDIT SUPPLIER */}
      {/* ========================================================= */}
      {showSupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-base">
                  {editingSupId ? 'Edit Supplier' : 'Add New Supplier'}
                </h3>
              </div>
              <button onClick={() => setShowSupModal(false)} className="p-1 hover:bg-luxury-brown-800 rounded text-luxury-brown-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Supplier / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supreme Hospitality Supplies"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500 font-serif font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={supMobile}
                    onChange={(e) => setSupMobile(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">GST Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 27AABCS1429B1Z2"
                    value={supGst}
                    onChange={(e) => setSupGst(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Office / Factory Address</label>
                <textarea
                  rows={2}
                  placeholder="Full physical address..."
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setShowSupModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-xl shadow"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL 4: NEW PURCHASE ORDER (+AUTOMATICALLY INCREASES STOCK) */}
      {/* ========================================================= */}
      {showPurModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-luxury-brown-900 via-luxury-brown-950 to-black text-white p-5 flex justify-between items-center shrink-0 border-b border-luxury-gold-500/20">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-base">New Purchase Order</h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                  +Auto Increase Stock
                </span>
              </div>
              <button onClick={() => setShowPurModal(false)} className="p-1 hover:bg-luxury-brown-800 rounded text-luxury-brown-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Select Supplier *</label>
                  <select
                    required
                    value={purSupplierId}
                    onChange={(e) => setPurSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500 font-medium"
                  >
                    {suppliers.length === 0 ? (
                      <option value="">No suppliers available</option>
                    ) : (
                      suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.gst || 'No GST'})</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={purDate}
                    onChange={(e) => setPurDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2 border-t border-luxury-brown-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold uppercase text-xs text-luxury-brown-900">Purchase Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddPurItemRow}
                    className="px-2.5 py-1 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-950 font-bold rounded-lg text-[11px] cursor-pointer flex items-center gap-1 border border-luxury-brown-300"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {purItems.map((item, idx) => {
                    const selP = products.find(p => p.id === item.productId);
                    return (
                      <div key={idx} className="p-3 bg-luxury-beige-50 rounded-xl border border-luxury-brown-200 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <label className="text-[9px] font-mono uppercase text-luxury-brown-400 block mb-0.5">Product</label>
                          <select
                            value={item.productId}
                            onChange={(e) => handlePurItemProductChange(idx, e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-luxury-brown-200 rounded-lg text-xs font-serif font-bold"
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="text-[9px] font-mono uppercase text-luxury-brown-400 block mb-0.5">Qty ({selP?.unit || 'Pcs'})</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handlePurItemQtyChange(idx, Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold text-center"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-[9px] font-mono uppercase text-luxury-brown-400 block mb-0.5">Unit Price</label>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handlePurItemPriceChange(idx, Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-luxury-brown-200 rounded-lg text-xs font-mono text-center"
                          />
                        </div>

                        <div className="col-span-2 text-right">
                          <label className="text-[9px] font-mono uppercase text-luxury-brown-400 block mb-0.5">Subtotal</label>
                          <span className="font-mono font-bold text-luxury-brown-950 block text-xs">
                            ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="col-span-1 text-right">
                          {purItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePurItemRow(idx)}
                              className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total & Notes */}
              <div className="p-3 bg-luxury-brown-900 text-luxury-gold-300 rounded-xl flex justify-between items-center font-mono font-bold">
                <span>Grand Total:</span>
                <span className="text-base text-white">₹{calculatePurGrandTotal().toLocaleString('en-IN')}</span>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Bill Ref / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #INV-882, Cash or Bank paid..."
                  value={purNotes}
                  onChange={(e) => setPurNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setShowPurModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-xl shadow flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save Order & Auto-Increase Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL 5: MANUAL STOCK IN */}
      {/* ========================================================= */}
      {showStockInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-emerald-300" />
                <h3 className="font-serif font-bold text-base">Record Stock In (+Add)</h3>
              </div>
              <button onClick={() => setShowStockInModal(false)} className="p-1 hover:bg-emerald-800 rounded text-emerald-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockIn} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Select Product *</label>
                <select
                  value={inProdId}
                  onChange={(e) => setInProdId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500 font-serif font-bold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name} (Current: {p.currentStock} {p.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Quantity to Add *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={inQty}
                    onChange={(e) => setInQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Date *</label>
                  <input
                    type="date"
                    required
                    value={inDate}
                    onChange={(e) => setInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Reason Type</label>
                <select
                  value={inReason}
                  onChange={(e) => setInReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                >
                  <option value="Manual Stock In">Manual Stock In</option>
                  <option value="Initial Opening Stock">Initial Opening Stock</option>
                  <option value="Return from Room">Return from Room</option>
                  <option value="Audit Correction">Audit Correction</option>
                  <option value="Other Addition">Other Addition</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={inNotes}
                  onChange={(e) => setInNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setShowStockInModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                >
                  Confirm Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL 6: MANUAL STOCK OUT */}
      {/* ========================================================= */}
      {showStockOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-rose-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-300" />
                <h3 className="font-serif font-bold text-base">Record Stock Out (-Deduct)</h3>
              </div>
              <button onClick={() => setShowStockOutModal(false)} className="p-1 hover:bg-rose-800 rounded text-rose-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockOut} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Select Product *</label>
                <select
                  value={outProdId}
                  onChange={(e) => setOutProdId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500 font-serif font-bold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name} (Current: {p.currentStock} {p.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Quantity to Issue *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={outQty}
                    onChange={(e) => setOutQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Date *</label>
                  <input
                    type="date"
                    required
                    value={outDate}
                    onChange={(e) => setOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl font-mono focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Reason / Purpose</label>
                <select
                  value={outReason}
                  onChange={(e) => setOutReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                >
                  <option value="Housekeeping Usage">Housekeeping Usage</option>
                  <option value="Room Amenities Issue">Room Amenities Issue</option>
                  <option value="Kitchen Issue">Kitchen Issue</option>
                  <option value="Maintenance Work">Maintenance Work</option>
                  <option value="Damaged / Expired">Damaged / Expired</option>
                  <option value="Loss or Theft">Loss or Theft</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Issued To / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Issued to Staff Ramesh or Room 104..."
                  value={outNotes}
                  onChange={(e) => setOutNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setShowStockOutModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl shadow"
                >
                  Deduct & Issue Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL 7: VIEW PURCHASE VOUCHER */}
      {/* ========================================================= */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-luxury-brown-900 to-black text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="font-serif font-bold text-base">Purchase Voucher Details</h3>
              </div>
              <button onClick={() => setViewingPurchase(null)} className="p-1 hover:bg-luxury-brown-800 rounded text-luxury-brown-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              <div className="flex justify-between items-start border-b border-luxury-brown-100 pb-3">
                <div>
                  <span className="font-mono text-luxury-gold-800 font-bold block text-sm">{viewingPurchase.purchaseNumber}</span>
                  <span className="text-luxury-brown-500 font-mono">Date: {viewingPurchase.date}</span>
                </div>
                <div className="text-right">
                  <span className="font-serif font-bold text-luxury-brown-950 block">{viewingPurchase.supplierName}</span>
                  <span className="text-[10px] text-emerald-800 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Status: {viewingPurchase.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-mono font-bold uppercase text-[10px] text-luxury-brown-700 block">Items Purchased</span>
                <div className="bg-luxury-beige-50 rounded-xl p-3 border border-luxury-brown-100 divide-y divide-luxury-brown-100">
                  {viewingPurchase.items.map((item, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-serif font-bold text-luxury-brown-950 block">[{item.productCode}] {item.productName}</span>
                        <span className="font-mono text-[10px] text-luxury-brown-500">
                          {item.quantity} x ₹{item.unitPrice}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-luxury-brown-950">
                        ₹{Number(item.totalPrice || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-luxury-brown-900 text-luxury-gold-300 rounded-xl flex justify-between items-center font-mono font-bold">
                <span>Grand Total Paid:</span>
                <span className="text-base text-white">₹{Number(viewingPurchase.grandTotal || 0).toLocaleString('en-IN')}</span>
              </div>

              {viewingPurchase.notes && (
                <div className="p-3 bg-white border border-luxury-brown-200 rounded-xl text-luxury-brown-700">
                  <span className="font-mono font-bold text-[10px] block uppercase text-luxury-brown-400">Notes</span>
                  <p className="font-sans italic">{viewingPurchase.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-luxury-beige-50 border-t border-luxury-brown-100 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setViewingPurchase(null)}
                className="px-5 py-2 bg-luxury-brown-900 text-white rounded-xl font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
