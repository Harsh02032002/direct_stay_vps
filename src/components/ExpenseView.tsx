import React, { useState } from 'react';
import { Expense, ExpenseCategory, UserRole } from '../types';
import { showToast } from '../utils/toast';
import { Plus, Search, Tag, Wallet, FileText, UploadCloud, Check } from 'lucide-react';

interface ExpenseViewProps {
  expenses: Expense[];
  currentRole: UserRole;
  onUpdateExpenses: (expenses: Expense[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function ExpenseView({ expenses, currentRole, onUpdateExpenses, onAddAuditLog }: ExpenseViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form fields
  const [category, setCategory] = useState<ExpenseCategory>('Food Expense');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(100);
  const [billFileName, setBillFileName] = useState('');
  const [billFileData, setBillFileData] = useState<string | null>(null);

  const [formError, setFormError] = useState('');

  // Handle billing attach files
  const handleBillSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBillFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setBillFileData(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!description.trim()) {
      setFormError('Expense Description is mandatory.');
      return;
    }

    if (amount <= 0) {
      setFormError('Amount must be positive.');
      return;
    }

    const newExpense: Expense = {
      id: `EXP-${100 + expenses.length + 1}`,
      category,
      date,
      description,
      amount,
      billFileName: billFileName || undefined,
      billFileData: billFileData || undefined,
    };

    onUpdateExpenses([...expenses, newExpense]);
    onAddAuditLog?.(
      'Expense Recorded',
      `Logged ${category} voucher ${newExpense.id} for ₹${amount.toLocaleString()} (${description}).`
    );
    setIsFormOpen(false);

    // clear selections
    setDescription('');
    setAmount(100);
    setBillFileName('');
    setBillFileData(null);
  };

  // Filter list
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(search.toLowerCase()) || exp.id.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || exp.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalExpenseSum = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const isRestrictedRole = currentRole === 'Receptionist';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-luxury-brown-100 pb-4">
        <div>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide">Hotel Operating Expense Ledger</h1>
          <p className="text-xs text-luxury-brown-500">Log pantry food bulk supplies, electrician utility labor, laundry chemical costs, and receptionist salaries</p>
        </div>
        {!isRestrictedRole && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-medium rounded-lg text-sm transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Log Expense Invoice
          </button>
        )}
      </div>

      {/* Filter and search panel */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 w-4 h-4 text-luxury-brown-400" />
          <input
            type="text"
            placeholder="Search descriptions, vouchers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-luxury-brown-200 rounded-lg text-sm focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-905"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-905"
          >
            <option value="All">All Categories</option>
            <option value="Food Expense">Food Expense</option>
            <option value="Labor Expense">Labor Expense</option>
            <option value="Maintenance Expense">Maintenance Expense</option>
            <option value="Utility Expense">Utility Expense</option>
            <option value="Other Expense">Other Expense</option>
          </select>
        </div>

        <div className="flex items-center justify-end font-mono text-xs text-luxury-brown-500 gap-1">
          <span>Operational Cash Outflow Tally:</span>
          <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-150">
            ₹{totalExpenseSum.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Expense ledger Data Table */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs divide-y divide-luxury-brown-100">
            <thead className="bg-luxury-beige-100/50 text-luxury-brown-700 font-medium">
              <tr>
                <th className="p-4">Voucher ID</th>
                <th className="p-4">Expense Description</th>
                <th className="p-4">Debit category</th>
                <th className="p-4 text-center">Incurred Date</th>
                <th className="p-4 text-right">Debit amount</th>
                <th className="p-4 text-center">Attached bill file</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-luxury-brown-100 text-luxury-brown-900 font-medium">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-luxury-brown-400 font-mono text-[10px] uppercase">
                    No active expense transactions matched your query parameters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-luxury-beige-50/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-luxury-brown-600">{exp.id}</td>
                    <td className="p-4 font-serif text-sm font-bold text-luxury-brown-900">
                      {exp.description}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full bg-luxury-beige-100 text-luxury-brown-805">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono">{exp.date}</td>
                    <td className="p-4 text-right font-mono font-bold text-rose-700">₹{Number(exp.amount || 0).toLocaleString()}</td>
                    <td className="p-4 text-center">
                      {exp.billFileName ? (
                        <span 
                          onClick={() => showToast(`Showing attachments metadata for digital archive reference: ${exp.billFileName}`, 'info')}
                          className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded border border-emerald-250 cursor-pointer hover:bg-emerald-100"
                        >
                          <FileText className="w-3 h-3 text-emerald-600" /> {exp.billFileName}
                        </span>
                      ) : (
                        <span className="text-[10px] text-luxury-brown-400 font-mono">No Bill Attached</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Expense dialogue form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative bg-white rounded-2xl border border-luxury-gold-500/20 shadow-2xl max-w-md w-full overflow-hidden">
            
            <div className="bg-luxury-brown-900 text-white p-5 flex justify-between items-center border-b border-luxury-gold-500/20">
              <div>
                <h3 className="text-lg font-serif font-medium text-luxury-gold-300 flex items-center gap-2">
                  <Wallet className="w-5 h-5" /> Log Expenditure Voucher
                </h3>
                <p className="text-[10px] text-luxury-brown-200 uppercase tracking-widest font-mono">
                  Direct ledger debit transaction registration
                </p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs rounded-md"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 text-rose-700 text-xs p-3.5 border-b border-rose-100 font-semibold text-center">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Debit category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905"
                >
                  <option value="Food Expense">Food Expense</option>
                  <option value="Labor Expense">Labor Expense</option>
                  <option value="Maintenance Expense">Maintenance Expense</option>
                  <option value="Utility Expense">Utility Expense (Electricity/Power)</option>
                  <option value="Other Expense">Other Expense</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Incurred Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Debit amount (INR ₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 font-semibold font-mono"
                />
              </div>

              <div className="space-y-1 font-sans">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Voucher Description</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Purchase of 5 gas cylinders for kitchen cook operations"
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905"
                />
              </div>

              {/* Bill file uploads */}
              <div className="border border-dashed border-luxury-brown-300 p-4 rounded-xl flex flex-col items-center justify-center bg-luxury-beige-50 hover:bg-luxury-beige-100/30 transition-all">
                <UploadCloud className="w-8 h-8 text-luxury-brown-500 mb-1" />
                <span className="text-xs font-serif font-bold text-luxury-brown-900 leading-tight">Attach Digital Bill Copy</span>
                <span className="text-[9px] text-luxury-brown-405 mt-1">Accepts pdf, png, jpeg format up to 5MB</span>
                <input
                  type="file"
                  id="expense-bill-upload"
                  className="hidden"
                  onChange={handleBillSelect}
                  accept=".pdf,image/*"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('expense-bill-upload')?.click()}
                  className="mt-2.5 px-3 py-1 bg-white border border-luxury-brown-200 rounded text-[9px] font-bold text-luxury-brown-700 shadow-xs"
                >
                  Locate Bill Image
                </button>
                {billFileName && (
                  <span className="text-[9px] text-emerald-600 font-mono font-bold mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500" /> {billFileName}
                  </span>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-luxury-brown-100/50">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-750 text-sm rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-white font-medium text-sm rounded-lg shadow-md"
                >
                  Log Debit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
