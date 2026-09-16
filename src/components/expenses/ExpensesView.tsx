import React, { useState, useEffect } from 'react';
import { Expense, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../common/Modal.tsx';
import {
  TrendingDown, Plus, Search, DollarSign, Calendar,
  Building, CheckCircle2, Tag
} from 'lucide-react';

interface ExpensesViewProps {
  user: User;
  activeBranchId: string;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ user, activeBranchId }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [category, setCategory] = useState('Rent');
  const [amount, setAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadExpenses();
  }, [activeBranchId]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await api.getExpenses({ branch_id: activeBranchId || undefined });
      setExpenses(res.expenses);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    try {
      await api.createExpense({
        branch_id: activeBranchId,
        category,
        amount,
        payment_method: paymentMethod,
        expense_date: expenseDate,
        description,
      });

      setIsOpen(false);
      setDescription('');
      loadExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense');
    }
  };

  const totalExpenseSum = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <TrendingDown className="w-6 h-6 text-amber-600 mr-2" />
            Operating Expenses & Overhead Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track branch commercial rent, utilities, staff wages, and operational costs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center">
            <span className="text-slate-500 mr-2">Total Expenses:</span>
            <span className="font-mono font-bold text-amber-800 text-sm">
              ${totalExpenseSum.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Operating Expense
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Loading expenses...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">No expenses recorded yet.</td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {new Date(e.expense_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {e.branch_name} ({e.branch_code})
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        <Tag className="w-3 h-3 mr-1 text-slate-400" />
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {e.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{e.payment_method}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-800">
                      ${Number(e.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{e.created_by_name || 'Staff'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: ADD EXPENSE ================= */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Record Operating Expense"
        subtitle="Log operational overhead for this branch location"
        maxWidth="md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Expense Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="Rent">Showroom / Warehouse Rent</option>
              <option value="Electricity">Electricity & Commercial Power</option>
              <option value="Internet">High-Speed Fiber / ISP</option>
              <option value="Salaries">Staff Wages / Bonuses</option>
              <option value="Advertising">Marketing & Mall Displays</option>
              <option value="Supplies">Store Supplies & Packaging</option>
              <option value="Maintenance">Maintenance & Repairs</option>
              <option value="Other">Other Miscellaneous</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Amount ($) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount === 0 ? '' : amount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setAmount(v === '' ? 0 : parseFloat(v) || 0);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Expense Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="Bank Transfer">Bank Transfer / ACH</option>
              <option value="Card">Business Credit/Debit Card</option>
              <option value="Cash">Cash (From Register Draw)</option>
              <option value="Check">Company Check</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Description / Bill Memo *</label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Monthly commercial lease payment for showroom Downtown"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
            >
              Log Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
