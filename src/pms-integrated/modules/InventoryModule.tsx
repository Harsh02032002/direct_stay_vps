import React, { useEffect, useRef, useState } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import {
  InventoryItemRecord,
  InventoryPurchaseRecord,
  InventorySupplierRecord,
  StockMovementRecord,
} from '../types';
import { formatCurrency } from '../utils/formatters';

interface InventoryModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  items: InventoryItemRecord[];
  suppliers: InventorySupplierRecord[];
  purchases: InventoryPurchaseRecord[];
  movements: StockMovementRecord[];
  onRecordStockMovement: (itemId: string, type: 'IN' | 'OUT', qty: number, department: string, reason: string) => void;
  onAddInventoryItem?: (item: InventoryItemRecord) => void;
  onUpdateInventoryItem?: (item: InventoryItemRecord) => void;
  onDeleteInventoryItem?: (itemId: string) => void;
  onAddSupplier?: (supplier: InventorySupplierRecord) => void;
  onAddPurchase?: (po: InventoryPurchaseRecord) => void;
}

const SUB_TABS = [
  { id: 'dashboard', label: 'Store Stock Overview' },
  { id: 'products', label: 'Items & Reorder Alerts' },
  { id: 'movements', label: 'Stock IN / OUT Register' },
  { id: 'purchases', label: 'Purchase Orders (PO)' },
  { id: 'suppliers', label: 'Verified Vendors' },
  { id: 'reports', label: 'Valuation Report' },
];

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  items,
  suppliers,
  purchases,
  movements,
  onRecordStockMovement,
  onAddInventoryItem,
  onUpdateInventoryItem,
  onDeleteInventoryItem,
  onAddSupplier,
  onAddPurchase,
}) => {
  const skuFormRef = useRef<HTMLFormElement | null>(null);
  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [moveType, setMoveType] = useState<'IN' | 'OUT'>('OUT');
  const [moveQty, setMoveQty] = useState(1);
  const [department, setDepartment] = useState('Housekeeping');
  const [reason, setReason] = useState('');

  const [localSuppliers, setLocalSuppliers] = useState<InventorySupplierRecord[]>(suppliers);
  const [localPurchases, setLocalPurchases] = useState<InventoryPurchaseRecord[]>(purchases);
  useEffect(() => setLocalSuppliers(suppliers), [suppliers]);
  useEffect(() => setLocalPurchases(purchases), [purchases]);
  useEffect(() => {
    if (!selectedItemId && items.length > 0) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  // New / Edit Store Item State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newSkuCode, setNewSkuCode] = useState('');
  const [newSkuName, setNewSkuName] = useState('');
  const [newSkuCat, setNewSkuCat] = useState<InventoryItemRecord['category']>('Housekeeping & Cleaning');
  const [newSkuUnit, setNewSkuUnit] = useState<InventoryItemRecord['unit']>('Pcs');
  const [newSkuCost, setNewSkuCost] = useState<number>(50);
  const [newSkuStock, setNewSkuStock] = useState<number>(20);
  const [newSkuMin, setNewSkuMin] = useState<number>(5);
  const [newSkuSupplier, setNewSkuSupplier] = useState('');

  const startEditItem = (item: InventoryItemRecord) => {
    setEditingItemId(item.id);
    setNewSkuCode(item.code || '');
    setNewSkuName(item.name || '');
    setNewSkuCat(item.category || 'Housekeeping & Cleaning');
    setNewSkuUnit(item.unit || 'Pcs');
    setNewSkuCost(Number(item.purchasePrice) || 0);
    setNewSkuStock(Number(item.currentStock) || 0);
    setNewSkuMin(Number(item.minStock) || 0);
    setNewSkuSupplier(item.supplierName || '');
    skuFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const resetSkuForm = () => {
    setEditingItemId(null);
    setNewSkuCode('');
    setNewSkuName('');
    setNewSkuCat('Housekeeping & Cleaning');
    setNewSkuUnit('Pcs');
    setNewSkuCost(50);
    setNewSkuStock(20);
    setNewSkuMin(5);
    setNewSkuSupplier('');
  };

  // New Supplier State
  const [supName, setSupName] = useState('');
  const [supMobile, setSupMobile] = useState('');
  const [supCategory, setSupCategory] = useState('Housekeeping & Linen');
  const [supGstin, setSupGstin] = useState('');
  const [supCity, setSupCity] = useState('');

  // New Purchase Order State
  const [poSupplier, setPoSupplier] = useState('');
  const [poItemsSummary, setPoItemsSummary] = useState('');
  const [poAmount, setPoAmount] = useState<number>(0);
  const [poPaymentStatus, setPoPaymentStatus] = useState<'Paid' | 'Partial' | 'Unpaid'>('Paid');

  const lowStockCount = items.filter((i) => i.currentStock <= i.minStock).length;
  const totalValuation = items.reduce((s, i) => s + i.currentStock * i.purchasePrice, 0);

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedItemId || items[0]?.id;
    if (!targetId) return;
    onRecordStockMovement(targetId, moveType, moveQty, department, reason || `${moveType} stock entry`);
    setReason('');
  };

  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    const newSup: InventorySupplierRecord = {
      id: `sup-${Date.now()}`,
      name: supName.trim(),
      contactPerson: supName.trim(),
      mobile: supMobile.trim(),
      gstin: supGstin.trim() || 'Unregistered',
      category: supCategory,
      city: supCity.trim() || 'Local',
      balancePayable: 0,
    };
    setLocalSuppliers((prev) => [newSup, ...prev]);
    if (onAddSupplier) onAddSupplier(newSup);
    setSupName('');
    setSupMobile('');
    setSupGstin('');
    setSupCity('');
  };

  const handleAddPurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplier.trim() || !poItemsSummary.trim() || poAmount <= 0) return;
    const newPo: InventoryPurchaseRecord = {
      id: `po-${Date.now()}`,
      poNumber: `PO-${Date.now().toString().slice(-5)}`,
      supplierName: poSupplier.trim(),
      itemsSummary: poItemsSummary.trim(),
      date: new Date().toISOString().slice(0, 10),
      totalAmount: poAmount,
      paymentStatus: poPaymentStatus,
      status: 'Received',
    };
    setLocalPurchases((prev) => [newPo, ...prev]);
    if (onAddPurchase) onAddPurchase(newPo);
    setPoSupplier('');
    setPoItemsSummary('');
    setPoAmount(0);
  };

  return (
    <div className="space-y-5">
      {/* Header & Sub-Tabs */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Central Inventory & Procurement Store
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Housekeeping Amenities, Kitchen Raw Materials, Linen Par Stock & Vendor Purchase Orders
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs w-full md:w-auto">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-bold text-center truncate">
              Store Value: {formatCurrency(totalValuation)}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 font-bold flex items-center justify-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Low Stock: {lowStockCount}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ITEMS & STOCK MOVEMENTS */}
      {(activeSubTab === 'dashboard' || activeSubTab === 'products' || activeSubTab === 'movements' || activeSubTab === 'reports') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Stock Issue / Restock Form + Add New Item */}
          <div className="space-y-4 h-fit">
            {(onAddInventoryItem || onUpdateInventoryItem) && (
              <form
                ref={skuFormRef}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSkuName.trim()) return;
                  if (editingItemId && onUpdateInventoryItem) {
                    const existing = items.find((i) => i.id === editingItemId);
                    const updatedItem: InventoryItemRecord = {
                      id: editingItemId,
                      code: newSkuCode.trim() || existing?.code || `SKU-${Math.floor(100 + Math.random() * 900)}`,
                      name: newSkuName.trim(),
                      category: newSkuCat || 'Housekeeping & Cleaning',
                      unit: newSkuUnit || 'Pcs',
                      purchasePrice: Math.max(0, Number(newSkuCost) || 0),
                      currentStock: Math.max(0, Number(newSkuStock) || 0),
                      minStock: Math.max(0, Number(newSkuMin) || 0),
                      supplierName: newSkuSupplier.trim() || existing?.supplierName || localSuppliers[0]?.name || 'Direct Vendor',
                      lastUpdated: new Date().toISOString().slice(0, 10),
                    };
                    onUpdateInventoryItem(updatedItem);
                    resetSkuForm();
                    return;
                  }
                  if (onAddInventoryItem) {
                    const newItem: InventoryItemRecord = {
                      id: `inv-${Date.now()}`,
                      code: newSkuCode.trim() || `SKU-${Math.floor(100 + Math.random() * 900)}`,
                      name: newSkuName.trim(),
                      category: newSkuCat,
                      unit: newSkuUnit || 'Pcs',
                      purchasePrice: Math.max(0, Number(newSkuCost) || 0),
                      currentStock: Math.max(0, Number(newSkuStock) || 0),
                      minStock: Math.max(0, Number(newSkuMin) || 0),
                      supplierName: newSkuSupplier.trim() || localSuppliers[0]?.name || 'Direct Vendor',
                      lastUpdated: new Date().toISOString().slice(0, 10),
                    };
                    onAddInventoryItem(newItem);
                    setSelectedItemId(newItem.id);
                    resetSkuForm();
                  }
                }}
                className={`bg-white p-5 rounded-2xl border shadow-sm space-y-3 transition-all ${
                  editingItemId ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    {editingItemId ? (
                      <>
                        <Pencil className="w-4 h-4 text-amber-600" />
                        <span>Edit Store SKU</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-amber-500" />
                        <span>+ Add Dynamic Store SKU</span>
                      </>
                    )}
                  </h3>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={resetSkuForm}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  )}
                </div>
                <div className="space-y-2.5 text-xs">
                  <input
                    type="text"
                    required
                    value={newSkuName}
                    onChange={(e) => setNewSkuName(e.target.value)}
                    placeholder="Item Name (e.g. Basmati Rice, Water 1L)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        list="inventory-sku-categories"
                        value={newSkuCat}
                        onChange={(e) => setNewSkuCat(e.target.value)}
                        placeholder="Select or type category..."
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                      />
                      <datalist id="inventory-sku-categories">
                        {Array.from(
                          new Set([
                            ...items.map((i) => i.category).filter(Boolean),
                            'Kitchen Raw Materials',
                            'Kitchen & F&B',
                            'Housekeeping & Cleaning',
                            'Guest Toiletries',
                            'Linen & Bedding',
                            'Electrical & Maintenance',
                            'Stationery & Front Desk',
                          ])
                        ).map((cat) => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <input
                        type="text"
                        list="inventory-sku-units"
                        value={newSkuUnit}
                        onChange={(e) => setNewSkuUnit(e.target.value)}
                        placeholder="Unit (Pcs/Kg/Ltr)"
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                      />
                      <datalist id="inventory-sku-units">
                        {['Pcs', 'Kg', 'gm', 'Ltr', 'ml', 'Box', 'Pack', 'Bottle', 'Roll', 'Set'].map((u) => (
                          <option key={u} value={u} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Cost (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={newSkuCost}
                        onChange={(e) => setNewSkuCost(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">
                        {editingItemId ? 'Current Stock' : 'Opening Qty'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={newSkuStock}
                        onChange={(e) => setNewSkuStock(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Min Alert</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={newSkuMin}
                        onChange={(e) => setNewSkuMin(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold"
                      />
                    </div>
                  </div>
                  {editingItemId && (
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">SKU Code</label>
                        <input
                          type="text"
                          value={newSkuCode}
                          onChange={(e) => setNewSkuCode(e.target.value)}
                          placeholder="SKU-101"
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Supplier</label>
                        <input
                          type="text"
                          list="inventory-po-vendors"
                          value={newSkuSupplier}
                          onChange={(e) => setNewSkuSupplier(e.target.value)}
                          placeholder="Vendor Name"
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold text-[11px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {editingItemId ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Save SKU Changes
                      </>
                    ) : (
                      '+ Add Item to Store'
                    )}
                  </button>
                </div>
              </form>
            )}

            <form
              onSubmit={handleMovementSubmit}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 h-fit"
            >
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                Issue / Receive Store Inventory
              </h3>
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMoveType('OUT')}
                    className={`py-1.5 rounded-lg font-bold ${
                      moveType === 'OUT' ? 'bg-rose-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    Stock OUT (Issue)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveType('IN')}
                    className={`py-1.5 rounded-lg font-bold ${
                      moveType === 'IN' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    Stock IN (Purchase)
                  </button>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Select Store Item</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {items.length === 0 ? (
                      <option value="">Add a store item above first</option>
                    ) : (
                      items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} (Stock: {it.currentStock} {it.unit})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Quantity</label>
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      value={moveQty}
                      onChange={(e) => setMoveQty(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Department</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                    >
                      <option value="Housekeeping">Housekeeping</option>
                      <option value="F&B Kitchen">F&B Kitchen</option>
                      <option value="Front Office">Front Office</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Purpose / Voucher Note</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Issued to floor 1 housekeeping"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs"
              >
                Record Stock {moveType} Entry
              </button>
            </form>
          </div>

          {/* Right Column: Stock Movements Register when on 'movements', otherwise SKU table */}
          {activeSubTab === 'movements' ? (
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  Stock IN / OUT Movement Ledger ({movements.length})
                </h3>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Qty</th>
                      <th className="py-3 px-4">Department & Reason</th>
                      <th className="py-3 px-4">Handled By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          No stock movements recorded yet.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr key={m.id}>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{m.date}</td>
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{m.productName}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.type === 'IN'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              Stock {m.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-extrabold whitespace-nowrap">{m.qty}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{m.department}</div>
                            <div className="text-[11px] text-slate-500">{m.reason}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{m.handledBy}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <h3 className="text-sm font-bold text-slate-900">Live Store SKU & Reorder Thresholds</h3>
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter SKUs..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3">SKU & Item</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Cost</th>
                      <th className="py-2.5 px-3">Stock</th>
                      <th className="py-2.5 px-3">Min Par</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()))
                      .length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          No store items added yet. Use the <strong>+ Add Dynamic Store SKU</strong> form on the left to add items.
                        </td>
                      </tr>
                    ) : (
                      items
                        .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()))
                        .map((item) => {
                          const isLow = item.currentStock <= item.minStock;
                          const isEditingRow = editingItemId === item.id;
                          return (
                            <tr
                              key={item.id}
                              className={isEditingRow ? 'bg-amber-50/70' : 'hover:bg-slate-50/60'}
                            >
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 leading-tight">{item.name}</div>
                                <div className="text-[10px] text-slate-400">
                                  {item.code} {item.supplierName ? `• ${item.supplierName}` : ''}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">{item.category}</td>
                              <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{formatCurrency(item.purchasePrice)}</td>
                              <td className="py-2.5 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                                {Number(Number(item.currentStock || 0).toFixed(4))} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                {item.minStock} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isLow ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {isLow ? 'Reorder Now' : 'Optimal'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => startEditItem(item)}
                                    title="Edit Store Item"
                                    className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" /> Edit
                                  </button>
                                  {onDeleteInventoryItem && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Delete "${item.name}" from Central Inventory Store?`)) {
                                          if (editingItemId === item.id) resetSkuForm();
                                          onDeleteInventoryItem(item.id);
                                        }
                                      }}
                                      title="Delete Store Item"
                                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUPPLIERS & PURCHASE ORDERS */}
      {(activeSubTab === 'suppliers' || activeSubTab === 'purchases') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Verified Vendors Column */}
          <div className="space-y-4">
            <form
              onSubmit={handleAddSupplierSubmit}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900">+ Add Verified Hotel Supplier</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="Supplier / Company Name *"
                  className="px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
                <input
                  type="text"
                  value={supMobile}
                  onChange={(e) => setSupMobile(e.target.value)}
                  placeholder="Mobile No."
                  className="px-3 py-2 rounded-xl border border-slate-200"
                />
                <input
                  type="text"
                  value={supCategory}
                  onChange={(e) => setSupCategory(e.target.value)}
                  placeholder="Supply Category"
                  className="px-3 py-2 rounded-xl border border-slate-200"
                />
                <input
                  type="text"
                  value={supGstin}
                  onChange={(e) => setSupGstin(e.target.value)}
                  placeholder="GSTIN (Optional)"
                  className="px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs"
              >
                + Save Verified Vendor
              </button>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 font-bold text-sm">
                Verified Hotel Vendors ({localSuppliers.length})
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Supplier Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">GSTIN</th>
                      <th className="py-3 px-4">Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No suppliers registered yet.
                        </td>
                      </tr>
                    ) : (
                      localSuppliers.map((sup) => (
                        <tr key={sup.id}>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{sup.name}</div>
                            <div className="text-[10px] text-slate-500">{sup.mobile}</div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">{sup.category}</td>
                          <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">{sup.gstin}</td>
                          <td className="py-3 px-4 font-extrabold text-rose-600 whitespace-nowrap">
                            {formatCurrency(sup.balancePayable)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Purchase Orders Column */}
          <div className="space-y-4">
            <form
              onSubmit={handleAddPurchaseSubmit}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900">+ Create Purchase Order (PO)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <input
                    type="text"
                    required
                    list="inventory-po-vendors"
                    value={poSupplier}
                    onChange={(e) => setPoSupplier(e.target.value)}
                    placeholder="Select or type Vendor Name *"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                  <datalist id="inventory-po-vendors">
                    {localSuppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.category} • {s.mobile}
                      </option>
                    ))}
                  </datalist>
                </div>
                <input
                  type="text"
                  required
                  value={poItemsSummary}
                  onChange={(e) => setPoItemsSummary(e.target.value)}
                  placeholder="Items Summary (e.g. 50x Soap, 10L Phenyl) *"
                  className="px-3 py-2 rounded-xl border border-slate-200"
                />
                <input
                  type="number"
                  min={1}
                  required
                  value={poAmount || ''}
                  onChange={(e) => setPoAmount(Number(e.target.value))}
                  placeholder="Total Bill Amount (₹) *"
                  className="px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
                <select
                  value={poPaymentStatus}
                  onChange={(e) => setPoPaymentStatus(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Unpaid">Unpaid (Credit)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs"
              >
                + Record Purchase Order
              </button>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 font-bold text-sm">
                Purchase Orders ({localPurchases.length})
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[540px] text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">PO #</th>
                      <th className="py-3 px-4">Vendor</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No purchase orders recorded yet.
                        </td>
                      </tr>
                    ) : (
                      localPurchases.map((po) => (
                        <tr key={po.id}>
                          <td className="py-3 px-4 font-bold whitespace-nowrap">{po.poNumber}</td>
                          <td className="py-3 px-4 font-semibold whitespace-nowrap">{po.supplierName}</td>
                          <td className="py-3 px-4 text-slate-600">{po.itemsSummary}</td>
                          <td className="py-3 px-4 font-extrabold whitespace-nowrap">{formatCurrency(po.totalAmount)}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              {po.status} ({po.paymentStatus})
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default InventoryModule;
