/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ExpenseLog, ExpenseCategory } from '../types';
import { DEFAULT_EXPENSE_CATEGORIES } from '../constants';
import { Plus, Trash2, Wallet, CreditCard, IndianRupee } from 'lucide-react';

interface ExpenseSectionProps {
  expenses: ExpenseLog[];
  onChange: (updatedExpenses: ExpenseLog[]) => void;
}

export const ExpenseSection: React.FC<ExpenseSectionProps> = ({
  expenses,
  onChange,
}) => {
  const [category, setCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0].name);
  const [customCategory, setCustomCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gpay'>('cash');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const expenseAmount = parseFloat(amount);
    if (!expenseAmount || expenseAmount <= 0) return;

    const finalCategory = category === 'Custom...' ? customCategory : category;
    if (!finalCategory.trim()) return;

    const newExpense: ExpenseLog = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category: finalCategory,
      amount: expenseAmount,
      description: description.trim(),
      paymentMethod,
    };

    onChange([...expenses, newExpense]);

    // Reset input fields
    setAmount('');
    setDescription('');
    if (category === 'Custom...') {
      setCategory(DEFAULT_EXPENSE_CATEGORIES[0].name);
      setCustomCategory('');
      setIsAddingCustom(false);
    }
  };

  const handleDeleteExpense = (id: string) => {
    onChange(expenses.filter((e) => e.id !== id));
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    if (val === 'Custom...') {
      setIsAddingCustom(true);
    } else {
      setIsAddingCustom(false);
    }
  };

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const cashExpenses = expenses.filter((e) => e.paymentMethod === 'cash').reduce((acc, e) => acc + e.amount, 0);
  const gpayExpenses = expenses.filter((e) => e.paymentMethod === 'gpay').reduce((acc, e) => acc + e.amount, 0);

  return (
    <section 
      className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8"
      aria-labelledby="expense-details-heading"
    >
      <div className="border-b border-slate-50 pb-4 mb-6">
        <h2 id="expense-details-heading" className="text-xl font-display font-bold text-slate-900">
          Expense Details
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Log daily business expenses (rent, labor, utilities). Specify whether paid from register cash or online/UPI (Gpay).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Quick Add Form */}
        <form onSubmit={handleAddExpense} className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
            Record New Expense
          </h3>

          <div>
            <label htmlFor="category-select" className="block text-xs font-medium text-slate-500 mb-1.5">
              Category
            </label>
            <select
              id="category-select"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {DEFAULT_EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
              <option value="Custom...">+ Add Custom Category...</option>
            </select>
          </div>

          {isAddingCustom && (
            <div>
              <label htmlFor="custom-category-input" className="block text-xs font-medium text-slate-500 mb-1.5">
                Custom Category Name
              </label>
              <input
                id="custom-category-input"
                type="text"
                required
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. Cleaning Supplies"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="expense-amount" className="block text-xs font-medium text-slate-500 mb-1.5">
                Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <IndianRupee className="w-3.5 h-3.5" />
                </span>
                <input
                  id="expense-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Paid Via
              </label>
              <div className="flex bg-slate-100 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    paymentMethod === 'cash'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('gpay')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    paymentMethod === 'gpay'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Gpay
                </button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="expense-description" className="block text-xs font-medium text-slate-500 mb-1.5">
              Description / Notes (Optional)
            </label>
            <input
              id="expense-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Paid morning shift helper"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all shadow-sm focus:outline-3"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </form>

        {/* Expenses List */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Logged Expenses
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {expenses.length} entry/entries
              </span>
            </div>

            {expenses.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">No expenses logged for today.</p>
                <p className="text-[10px] text-slate-400 mt-1">Use the form on the left to add expenses like rent, salaries, or petrol.</p>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-center">Method</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-slate-800">{exp.category}</td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate">
                          {exp.description || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${
                              exp.paymentMethod === 'cash'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100/50'
                                : 'bg-blue-50 text-blue-700 border border-blue-100/30'
                            }`}
                          >
                            {exp.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-bold">
                          ₹{exp.amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label={`Delete expense entry for ${exp.category}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Running Totals */}
          <div className="mt-6 border-t border-slate-50 pt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Paid in Cash
              </span>
              <span className="font-mono font-semibold text-slate-600 text-xs">
                ₹{cashExpenses.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Paid via Gpay
              </span>
              <span className="font-mono font-semibold text-slate-600 text-xs">
                ₹{gpayExpenses.toFixed(2)}
              </span>
            </div>
            <div className="bg-blue-50/50 rounded-xl py-2">
              <span className="block text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-0.5">
                Total Expenses
              </span>
              <span className="font-mono font-bold text-blue-600 text-sm">
                ₹{totalExpenses.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
