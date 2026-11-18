import React, { useState } from 'react';
import { PosItem, PosCategory, PosCoupon, InventoryProduct } from '../../types';
import { showToast, showConfirmToast } from '../../utils/toast';
import {
  Layers,
  Plus,
  Edit,
  Trash2,
  Tag,
  CheckCircle,
  XCircle,
  Percent,
  DollarSign,
  Utensils,
  Search,
  Sparkles
} from 'lucide-react';

interface PosCatalogManagerProps {
  items: PosItem[];
  onUpdateItems: (items: PosItem[]) => void;
  categories: PosCategory[];
  onUpdateCategories: (categories: PosCategory[]) => void;
  coupons: PosCoupon[];
  onUpdateCoupons: (coupons: PosCoupon[]) => void;
  inventoryProducts?: InventoryProduct[];
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function PosCatalogManager({
  items,
  onUpdateItems,
  categories,
  onUpdateCategories,
  coupons,
  onUpdateCoupons,
  inventoryProducts = [],
  onAddAuditLog
}: PosCatalogManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'categories' | 'coupons'>('items');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Item Modal State
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PosItem | null>(null);
  const [itemForm, setItemForm] = useState<{
    name: string;
    code: string;
    category: string;
    price: number;
    taxRate: number;
    available: boolean;
    kitchenStation: string;
    inventoryProductId: string;
    variantsInput: string; // "Small:100, Large:150"
    addonsInput: string; // "Extra Cheese:30, Dip:20"
    modifiersInput: string; // "Less Spicy, Extra Hot, Jain"
  }>({
    name: '',
    code: '',
    category: categories[0]?.name || 'Food & Restaurant',
    price: 100,
    taxRate: 5,
    available: true,
    kitchenStation: 'Main Kitchen',
    inventoryProductId: '',
    variantsInput: '',
    addonsInput: '',
    modifiersInput: ''
  });

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<PosCategory | null>(null);
  const [categoryName, setCategoryName] = useState<string>('');
  const [categoryDesc, setCategoryDesc] = useState<string>('');

  // Coupon Modal State
  const [showCouponModal, setShowCouponModal] = useState<boolean>(false);
  const [couponForm, setCouponForm] = useState<{
    code: string;
    discountType: 'Percentage' | 'Fixed';
    discountValue: number;
    minOrderValue: number;
    active: boolean;
  }>({
    code: '',
    discountType: 'Percentage',
    discountValue: 10,
    minOrderValue: 200,
    active: true
  });

  // Handlers for Menu Items
  const handleOpenEditItem = (item: PosItem) => {
    setEditingItem(item);
    const variantsStr = item.variants
      ? item.variants.map(v => `${v.name}:${v.price}`).join(', ')
      : '';
    const addonsStr = item.addons
      ? item.addons.map(a => `${a.name}:${a.price}`).join(', ')
      : '';
    const modifiersStr = item.modifiers ? item.modifiers.join(', ') : '';

    setItemForm({
      name: item.name,
      code: item.code,
      category: item.category,
      price: item.price,
      taxRate: item.taxRate,
      available: item.available,
      kitchenStation: item.kitchenStation || 'Main Kitchen',
      inventoryProductId: item.inventoryProductId || '',
      variantsInput: variantsStr,
      addonsInput: addonsStr,
      modifiersInput: modifiersStr
    });
    setShowItemModal(true);
  };

  const handleSaveItem = () => {
    const trimmedName = itemForm.name.trim();
    if (!trimmedName) {
      showToast('Please enter the menu item name.', 'warning');
      return;
    }
    const numericPrice = Math.max(0, Number(itemForm.price) || 0);

    // Parse Variants
    const parsedVariants = itemForm.variantsInput
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
      .map((v, idx) => {
        const [vName, vPrice] = v.split(':');
        return {
          id: `var-${idx}-${Date.now()}`,
          name: vName.trim(),
          price: Number(vPrice) || numericPrice
        };
      });

    // Parse Addons
    const parsedAddons = itemForm.addonsInput
      .split(',')
      .map(a => a.trim())
      .filter(Boolean)
      .map((a, idx) => {
        const [aName, aPrice] = a.split(':');
        return {
          id: `add-${idx}-${Date.now()}`,
          name: aName.trim(),
          price: Number(aPrice) || 20
        };
      });

    // Parse Modifiers
    const parsedModifiers = itemForm.modifiersInput
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    const chosenCategory = itemForm.category.trim() || categories[0]?.name || 'Main Course';
    if (!categories.some(c => c.name.toLowerCase() === chosenCategory.toLowerCase())) {
      onUpdateCategories([
        ...categories,
        { id: `cat-${Date.now()}`, name: chosenCategory, description: `${chosenCategory} dishes` }
      ]);
    }

    if (editingItem) {
      const updated = items.map(i =>
        i.id === editingItem.id
          ? {
              ...i,
              name: trimmedName,
              code: itemForm.code.trim() || i.code,
              category: chosenCategory,
              price: numericPrice,
              taxRate: Math.max(0, Number(itemForm.taxRate) || 0),
              available: itemForm.available,
              kitchenStation: itemForm.kitchenStation,
              inventoryProductId: itemForm.inventoryProductId || undefined,
              variants: parsedVariants.length > 0 ? parsedVariants : undefined,
              addons: parsedAddons.length > 0 ? parsedAddons : undefined,
              modifiers: parsedModifiers.length > 0 ? parsedModifiers : undefined
            }
          : i
      );
      onUpdateItems(updated);
      onAddAuditLog?.(
        'POS Menu Item Updated',
        `Updated POS menu item "${trimmedName}" (${itemForm.code || editingItem.code}) at ₹${numericPrice}.`
      );
      showToast(`Menu item "${trimmedName}" updated to ₹${numericPrice}!`, 'success');
    } else {
      const newItem: PosItem = {
        id: `pos-item-${Date.now()}`,
        name: trimmedName,
        code: itemForm.code.trim() || `POS-${Math.floor(100 + Math.random() * 900)}`,
        category: chosenCategory,
        price: numericPrice,
        taxRate: Math.max(0, Number(itemForm.taxRate) || 0),
        available: itemForm.available,
        kitchenStation: itemForm.kitchenStation,
        inventoryProductId: itemForm.inventoryProductId || undefined,
        variants: parsedVariants.length > 0 ? parsedVariants : undefined,
        addons: parsedAddons.length > 0 ? parsedAddons : undefined,
        modifiers: parsedModifiers.length > 0 ? parsedModifiers : undefined
      };
      onUpdateItems([...items, newItem]);
      onAddAuditLog?.(
        'POS Menu Item Added',
        `Added POS menu item "${newItem.name}" (${newItem.code}) in ${newItem.category} at ₹${newItem.price}.`
      );
      showToast(`Added "${newItem.name}" (₹${newItem.price}) to POS Menu!`, 'success');
    }

    setShowItemModal(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async (id: string) => {
    const target = items.find(i => i.id === id);
    const confirmed = await showConfirmToast(`Delete menu item "${target?.name || id}"?`, {
      title: 'Delete POS Menu Item',
      confirmLabel: 'Delete Item',
      variant: 'danger'
    });
    if (confirmed) {
      onUpdateItems(items.filter(i => i.id !== id));
      onAddAuditLog?.(
        'POS Menu Item Deleted',
        `Deleted POS menu item "${target?.name || id}" (${target?.code || id}).`
      );
      showToast(`Deleted "${target?.name || 'item'}" from POS Menu.`, 'info');
    }
  };

  // Handlers for Categories
  const handleSaveCategory = () => {
    const cleanName = categoryName.trim();
    if (!cleanName) {
      showToast('Please enter a category name.', 'warning');
      return;
    }
    if (editingCategory) {
      const oldName = editingCategory.name;
      onUpdateCategories(
        categories.map(c =>
          c.id === editingCategory.id ? { ...c, name: cleanName, description: categoryDesc.trim() } : c
        )
      );
      if (oldName !== cleanName && items.some(i => i.category === oldName)) {
        onUpdateItems(items.map(i => (i.category === oldName ? { ...i, category: cleanName } : i)));
      }
      onAddAuditLog?.('POS Category Updated', `Renamed POS category "${oldName}" to "${cleanName}".`);
      showToast(`Category "${cleanName}" updated!`, 'success');
    } else {
      const newCat: PosCategory = {
        id: `cat-${Date.now()}`,
        name: cleanName,
        description: categoryDesc.trim()
      };
      onUpdateCategories([...categories, newCat]);
      onAddAuditLog?.(
        'POS Category Added',
        `Added POS menu category "${cleanName}".`
      );
      showToast(`Category "${cleanName}" added!`, 'success');
    }
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDesc('');
  };

  const handleDeleteCategory = async (id: string) => {
    const target = categories.find(c => c.id === id);
    const confirmed = await showConfirmToast(`Delete menu category "${target?.name || id}"?`, {
      title: 'Delete POS Category',
      confirmLabel: 'Delete Category',
      variant: 'danger'
    });
    if (confirmed) {
      onUpdateCategories(categories.filter(c => c.id !== id));
      onAddAuditLog?.(
        'POS Category Deleted',
        `Deleted POS menu category "${target?.name || id}".`
      );
      showToast(`Category "${target?.name || ''}" removed.`, 'info');
    }
  };

  // Handlers for Coupons
  const handleSaveCoupon = () => {
    if (!couponForm.code.trim()) {
      showToast('Please enter a coupon code.', 'warning');
      return;
    }
    const newCpn: PosCoupon = {
      id: `cpn-${Date.now()}`,
      code: couponForm.code.trim().toUpperCase(),
      discountType: couponForm.discountType,
      discountValue: Number(couponForm.discountValue),
      minOrderValue: Number(couponForm.minOrderValue),
      active: couponForm.active
    };
    onUpdateCoupons([...coupons, newCpn]);
    onAddAuditLog?.(
      'POS Coupon Created',
      `Created POS promo coupon "${newCpn.code}" (${newCpn.discountValue}${newCpn.discountType === 'Percentage' ? '%' : ' INR'} off, min order ₹${newCpn.minOrderValue}).`
    );
    showToast(`Promo coupon "${newCpn.code}" created!`, 'success');
    setShowCouponModal(false);
  };

  const handleDeleteCoupon = async (id: string) => {
    const target = coupons.find(c => c.id === id);
    const confirmed = await showConfirmToast(`Delete promo coupon "${target?.code || id}"?`, {
      title: 'Delete Promo Coupon',
      confirmLabel: 'Delete Coupon',
      variant: 'danger'
    });
    if (confirmed) {
      onUpdateCoupons(coupons.filter(c => c.id !== id));
      onAddAuditLog?.(
        'POS Coupon Deleted',
        `Deleted POS promo coupon "${target?.code || id}".`
      );
      showToast(`Coupon "${target?.code || ''}" deleted.`, 'info');
    }
  };

  const filteredItems = items.filter(
    i =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub Tab Switcher Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Menu Catalog & Discount Management</h2>
          <p className="text-xs text-slate-500">
            Configure menu categories, variants, addons, modifiers, inventory links, and coupons.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('items')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'items'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Menu Items ({items.length})
          </button>
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'categories'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveSubTab('coupons')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'coupons'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Coupons ({coupons.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: MENU ITEMS */}
      {activeSubTab === 'items' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <button
              onClick={() => {
                setEditingItem(null);
                setItemForm({
                  name: '',
                  code: `POS-${Math.floor(100 + Math.random() * 900)}`,
                  category: categories[0]?.name || 'Food & Restaurant',
                  price: 150,
                  taxRate: 5,
                  available: true,
                  kitchenStation: 'Main Kitchen',
                  inventoryProductId: '',
                  variantsInput: '',
                  addonsInput: '',
                  modifiersInput: ''
                });
                setShowItemModal(true);
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Menu Item</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">GST</th>
                  <th className="py-3 px-4">Kitchen Station</th>
                  <th className="py-3 px-4">Variants / Addons</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{item.name}</td>
                    <td className="py-3 px-4">{item.category}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{item.price}</td>
                    <td className="py-3 px-4">{item.taxRate}%</td>
                    <td className="py-3 px-4">{item.kitchenStation || 'Main Kitchen'}</td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {item.variants && <div>Vars: {item.variants.length}</div>}
                      {item.addons && <div>Addons: {item.addons.length}</div>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.available ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEditItem(item)}
                        className="p-1.5 text-slate-500 hover:text-amber-700 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CATEGORIES */}
      {activeSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryName('');
                setCategoryDesc('');
                setShowCategoryModal(true);
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map(cat => {
              const catItemsCount = items.filter(i => i.category === cat.name).length;
              return (
                <div key={cat.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800 text-sm">{cat.name}</h4>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        title="Edit Category"
                        onClick={() => {
                          setEditingCategory(cat);
                          setCategoryName(cat.name);
                          setCategoryDesc(cat.description || '');
                          setShowCategoryModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-700 cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete Category"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{cat.description || 'No description provided.'}</p>
                  <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-amber-800">
                    {catItemsCount} items linked
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: COUPONS */}
      {activeSubTab === 'coupons' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCouponModal(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 flex items-center space-x-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Promo Coupon</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {coupons.map(cpn => (
              <div key={cpn.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-black text-slate-900 text-sm bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                    {cpn.code}
                  </span>
                  <button onClick={() => handleDeleteCoupon(cpn.id)} className="text-slate-400 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-slate-700 font-bold">
                  Discount: {cpn.discountType === 'Percentage' ? `${cpn.discountValue}% OFF` : `₹${cpn.discountValue} FLAT OFF`}
                </div>
                <div className="text-[11px] text-slate-500">
                  Min Order: ₹{cpn.minOrderValue}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Menu Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800">
              {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Item Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Paneer Butter Masala"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Item Code</label>
                  <input
                    type="text"
                    placeholder="POS-F01"
                    value={itemForm.code}
                    onChange={e => setItemForm({ ...itemForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Category</label>
                  <input
                    type="text"
                    list="pos-catalog-category-options"
                    placeholder="Select or type category..."
                    value={itemForm.category}
                    onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <datalist id="pos-catalog-category-options">
                    {Array.from(
                      new Set([
                        ...categories.map(c => c.name),
                        ...items.map(i => i.category).filter(Boolean)
                      ])
                    ).map(catName => (
                      <option key={catName} value={catName} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={itemForm.price}
                    onChange={e => setItemForm({ ...itemForm, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">GST Tax Rate (%)</label>
                  <select
                    value={itemForm.taxRate}
                    onChange={e => setItemForm({ ...itemForm, taxRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value={0}>0% (Tax Exempt)</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Variants (Name:Price, comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Half:120, Full:200"
                  value={itemForm.variantsInput}
                  onChange={e => setItemForm({ ...itemForm, variantsInput: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Add-ons (Name:Price, comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Extra Cheese:30, Garlic Dip:20"
                  value={itemForm.addonsInput}
                  onChange={e => setItemForm({ ...itemForm, addonsInput: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Modifiers (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Less Spicy, Extra Hot, Jain"
                  value={itemForm.modifiersInput}
                  onChange={e => setItemForm({ ...itemForm, modifiersInput: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {inventoryProducts.length > 0 && (
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Link to Inventory Product (Auto Stock Deduct)</label>
                  <select
                    value={itemForm.inventoryProductId}
                    onChange={e => setItemForm({ ...itemForm, inventoryProductId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- No Inventory Link --</option>
                    {inventoryProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.currentStock} {p.unit} in stock)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowItemModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-lg text-xs hover:bg-amber-700"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800">
              {editingCategory ? 'Edit Menu Category' : 'Add Menu Category'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Desserts & Bakery"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short description..."
                  value={categoryDesc}
                  onChange={e => setCategoryDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-lg text-xs hover:bg-amber-700"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800">Add Promo Coupon</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Coupon Code</label>
                <input
                  type="text"
                  placeholder="WELCOME10"
                  value={couponForm.code}
                  onChange={e => setCouponForm({ ...couponForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Discount Type</label>
                  <select
                    value={couponForm.discountType}
                    onChange={e =>
                      setCouponForm({
                        ...couponForm,
                        discountType: e.target.value as 'Percentage' | 'Fixed'
                      })
                    }
                    className="w-full px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Value</label>
                  <input
                    type="number"
                    value={couponForm.discountValue}
                    onChange={e => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Min Order Value (₹)</label>
                <input
                  type="number"
                  value={couponForm.minOrderValue}
                  onChange={e => setCouponForm({ ...couponForm, minOrderValue: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowCouponModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCoupon}
                className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-lg text-xs hover:bg-amber-700"
              >
                Save Coupon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
