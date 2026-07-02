/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CashDetailsLog, ExpenseLog } from '../types';
import { CreditCard, IndianRupee, Wallet, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

interface CashSectionProps {
  cashDetails: CashDetailsLog;
  expenses: ExpenseLog[];
  onChange: (updatedCash: CashDetailsLog) => void;
}

export const CashSection: React.FC<CashSectionProps> = ({
  cashDetails,
  expenses,
  onChange,
}) => {
  const handleFieldChange = (field: keyof CashDetailsLog, value: number) => {
    onChange({
      ...cashDetails,
      [field]: Math.max(0, value),
    });
  };

  // Calculate Cash Expenses (expenses paid in cash, which drain the register)
  const cashExpenses = expenses
    .filter((e) => e.paymentMethod === 'cash')
    .reduce((acc, e) => acc + e.amount, 0);

  // Calculate Expected Closing Cash: Opening Cash + Hand Sales - Cash Expenses
  const expectedClosingCash =
    cashDetails.morningOpening + cashDetails.handSales - cashExpenses;

  // Actual cash entered by user
  const actualClosingCash = cashDetails.nightClosing;

  // Discrepancy
  const discrepancy = actualClosingCash - expectedClosingCash;

  // Total recorded sales cash: Hand + Gpay
  const totalRecordedSales = cashDetails.handSales + cashDetails.gpaySales;

  return (
    <section 
      className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8"
      aria-labelledby="cash-details-heading"
    >
      <div className="border-b border-slate-50 pb-4 mb-6">
        <h2 id="cash-details-heading" className="text-xl font-display font-bold text-slate-900">
          Cash Details & Reconciliation
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Monitor cash in register and electronic sales. System reconciles cash against opening balance and cash expenses.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entry Form */}
        <div className="space-y-4">
          <div>
            <label 
              htmlFor="morningOpening" 
              className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
            >
              Morning Opening Cash (₹)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Wallet className="w-4 h-4" />
              </span>
              <input
                id="morningOpening"
                type="number"
                min="0"
                step="0.01"
                value={cashDetails.morningOpening || ''}
                onChange={(e) => handleFieldChange('morningOpening', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2.5 font-mono border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Starting amount of paper cash in the register/drawer.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label 
                htmlFor="handSales" 
                className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
              >
                Today Sales (Hand Cash)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <IndianRupee className="w-4 h-4" />
                </span>
                <input
                  id="handSales"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashDetails.handSales || ''}
                  onChange={(e) => handleFieldChange('handSales', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2.5 font-mono border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label 
                htmlFor="gpaySales" 
                className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
              >
                Today Sales (Gpay/UPI)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <CreditCard className="w-4 h-4" />
                </span>
                <input
                  id="gpaySales"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashDetails.gpaySales || ''}
                  onChange={(e) => handleFieldChange('gpaySales', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2.5 font-mono border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label 
              htmlFor="nightClosing" 
              className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
            >
              Night Closing Cash (₹)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <IndianRupee className="w-4 h-4" />
              </span>
              <input
                id="nightClosing"
                type="number"
                min="0"
                step="0.01"
                value={cashDetails.nightClosing || ''}
                onChange={(e) => handleFieldChange('nightClosing', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2.5 font-mono border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none font-semibold text-slate-800"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Actual paper cash counted in the register/drawer at night.</p>
          </div>
        </div>

        {/* Live Reconciliation Results */}
        <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Cash Audit Calculator
            </h3>
            
            <div className="space-y-2 font-mono text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Opening Register:</span>
                <span className="text-slate-900">₹{cashDetails.morningOpening.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>+ Hand Cash Sales:</span>
                <span>+₹{cashDetails.handSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-500">
                <span>- Cash Expenses:</span>
                <span>-₹{cashExpenses.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 my-2 pt-2 flex justify-between font-semibold text-slate-850">
                <span>Expected Closing Cash:</span>
                <span>₹{expectedClosingCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-blue-600 font-bold">
                <span>Actual Closing Cash:</span>
                <span>₹{actualClosingCash.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Audit Status */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            {discrepancy === 0 ? (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl p-3.5 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">Register Balanced</div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Paper cash in register perfectly matches expected earnings. Great job!
                  </p>
                </div>
              </div>
            ) : discrepancy > 0 ? (
              <div className="bg-amber-50 text-amber-800 border border-amber-100 rounded-xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1">
                    Cash Surplus: <span className="font-mono text-amber-700 font-bold">+₹{discrepancy.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    There is more physical cash in the drawer than expected. Check for unrecorded sales or incorrect cash change given.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50 text-rose-800 border border-rose-100 rounded-xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1">
                    Cash Shortage: <span className="font-mono text-rose-700 font-bold">-₹{Math.abs(discrepancy).toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    Physical cash is short. Confirm whether there was an unrecorded expense paid in cash or an error in cash handling.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Sales Summary Bar */}
      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-50 pt-5 text-center">
        <div>
          <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Hand Cash Sales
          </span>
          <span className="font-mono font-semibold text-slate-700 text-sm">
            ₹{cashDetails.handSales.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Gpay/UPI Sales
          </span>
          <span className="font-mono font-semibold text-slate-700 text-sm">
            ₹{cashDetails.gpaySales.toFixed(2)}
          </span>
        </div>
        <div className="bg-blue-50/50 rounded-xl py-2">
          <span className="block text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1">
            Total Cash Sales
          </span>
          <span className="font-mono font-bold text-blue-600 text-base">
            ₹{totalRecordedSales.toFixed(2)}
          </span>
        </div>
      </div>
    </section>
  );
};
