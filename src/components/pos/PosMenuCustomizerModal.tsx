import React, { useState } from 'react';
import { PosItem, PosItemVariant, PosItemAddon } from '../../types';
import {
  Utensils,
  Plus,
  Minus,
  CheckCircle,
  XCircle,
  Tag,
  Sparkles
} from 'lucide-react';

interface PosMenuCustomizerModalProps {
  item: PosItem;
  onClose: () => void;
  onAddToCart: (configuredItem: {
    item: PosItem;
    quantity: number;
    selectedVariant?: string;
    selectedAddons?: string[];
    selectedModifiers?: string[];
    itemNotes?: string;
    finalUnitPrice: number;
  }) => void;
}

export default function PosMenuCustomizerModal({
  item,
  onClose,
  onAddToCart
}: PosMenuCustomizerModalProps) {
  const baseMatchesVariant =
    Number(item.price) > 0 && Array.isArray(item.variants)
      ? item.variants.find(v => Math.abs((Number(v.price) || 0) - Number(item.price)) < 0.005) || null
      : null;
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedVariant, setSelectedVariant] = useState<PosItemVariant | null>(
    Number(item.price) > 0
      ? baseMatchesVariant
      : item.variants && item.variants.length > 0
      ? item.variants[0]
      : null
  );
  const [selectedAddons, setSelectedAddons] = useState<PosItemAddon[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [itemNotes, setItemNotes] = useState<string>('');

  const basePrice = selectedVariant ? selectedVariant.price : item.price;
  const addonsTotal = selectedAddons.reduce((acc, a) => acc + a.price, 0);
  const unitPrice = basePrice + addonsTotal;
  const totalPrice = unitPrice * quantity;

  const handleToggleAddon = (addon: PosItemAddon) => {
    if (selectedAddons.some(a => a.id === addon.id)) {
      setSelectedAddons(selectedAddons.filter(a => a.id !== addon.id));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handleToggleModifier = (mod: string) => {
    if (selectedModifiers.includes(mod)) {
      setSelectedModifiers(selectedModifiers.filter(m => m !== mod));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  const handleConfirmAddToCart = () => {
    onAddToCart({
      item,
      quantity,
      selectedVariant: selectedVariant?.name,
      selectedAddons: selectedAddons.map(a => a.name),
      selectedModifiers,
      itemNotes: itemNotes.trim() || undefined,
      finalUnitPrice: unitPrice
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
              {item.code}
            </span>
            <h3 className="font-bold text-slate-800 text-base mt-1">{item.name}</h3>
            <p className="text-xs text-slate-500">{item.category} • GST {item.taxRate}%</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Variants Selection */}
        {item.variants && item.variants.length > 0 && (
          <div className="space-y-2 text-xs">
            <label className="font-bold text-slate-700 block">Select Portion / Variant:</label>
            <div className="grid grid-cols-2 gap-2">
              {Number(item.price) > 0 && !baseMatchesVariant && (
                <button
                  type="button"
                  onClick={() => setSelectedVariant(null)}
                  className={`p-2.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                    selectedVariant === null
                      ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500 text-amber-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                  }`}
                >
                  <span>Full / Base</span>
                  <span className="font-bold">₹{item.price}</span>
                </button>
              )}
              {item.variants.map(varItem => (
                <button
                  key={varItem.id}
                  onClick={() => setSelectedVariant(varItem)}
                  className={`p-2.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                    selectedVariant?.id === varItem.id
                      ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500 text-amber-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                  }`}
                >
                  <span>{varItem.name}</span>
                  <span className="font-bold">₹{varItem.price}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Addons Selection */}
        {item.addons && item.addons.length > 0 && (
          <div className="space-y-2 text-xs">
            <label className="font-bold text-slate-700 block">Optional Add-ons:</label>
            <div className="space-y-1.5">
              {item.addons.map(addon => {
                const isSelected = selectedAddons.some(a => a.id === addon.id);
                return (
                  <button
                    key={addon.id}
                    onClick={() => handleToggleAddon(addon)}
                    className={`w-full p-2.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                      isSelected
                        ? 'bg-amber-50 border-amber-500 text-amber-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-amber-200'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${isSelected ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-300'}`}>
                        {isSelected ? '✓' : ''}
                      </span>
                      <span>{addon.name}</span>
                    </span>
                    <span className="font-bold">+₹{addon.price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modifiers Selection */}
        {item.modifiers && item.modifiers.length > 0 && (
          <div className="space-y-2 text-xs">
            <label className="font-bold text-slate-700 block">Kitchen Preparation Modifiers:</label>
            <div className="flex flex-wrap gap-1.5">
              {item.modifiers.map(mod => {
                const isSelected = selectedModifiers.includes(mod);
                return (
                  <button
                    key={mod}
                    onClick={() => handleToggleModifier(mod)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {mod}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Item Special Notes */}
        <div className="space-y-1 text-xs">
          <label className="font-bold text-slate-700 block">Special Kitchen Notes (Optional):</label>
          <input
            type="text"
            placeholder="e.g. Extra hot, serve with green chutney"
            value={itemNotes}
            onChange={e => setItemNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Quantity and Add Button */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Quantity:</span>
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-7 h-7 bg-white rounded-lg font-bold text-slate-800 shadow-xs hover:bg-slate-200 flex items-center justify-center"
              >
                -
              </button>
              <span className="w-8 text-center font-bold text-sm text-slate-900">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-7 h-7 bg-white rounded-lg font-bold text-slate-800 shadow-xs hover:bg-slate-200 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={handleConfirmAddToCart}
            className="w-full py-3 bg-amber-600 text-white font-extrabold rounded-xl hover:bg-amber-700 shadow-xs flex items-center justify-between px-4 text-sm"
          >
            <span>Add Custom Item to Ticket</span>
            <span>₹{totalPrice.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
