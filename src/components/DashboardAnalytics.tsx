/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DailyLog } from '../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, Award, IndianRupee, BarChart2, Calendar, HelpCircle } from 'lucide-react';

interface DashboardAnalyticsProps {
  logs: DailyLog[];
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({ logs }) => {
  // Sort logs chronological (oldest to newest) for line charts
  const chronologicalLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  // 1. Prepare data for Sales & Expenses Area Chart
  const trendData = chronologicalLogs.map((log) => {
    const totalRecordedSales = log.cashDetails.handSales + log.cashDetails.gpaySales;
    const totalExpenses = log.expenses.reduce((acc, e) => acc + e.amount, 0);
    const totalProfit = totalRecordedSales - totalExpenses;

    return {
      dateStr: log.date.substring(5), // MM-DD for cleaner label
      Sales: totalRecordedSales,
      Expenses: totalExpenses,
      Profit: totalProfit,
    };
  });

  // 2. Prepare data for Item Sales Breakdown
  const itemVolumeMap: { [itemName: string]: number } = {};
  logs.forEach((log) => {
    log.stockItems.forEach((item) => {
      itemVolumeMap[item.itemName] = (itemVolumeMap[item.itemName] || 0) + item.salesCount;
    });
  });

  const itemVolumeData = Object.entries(itemVolumeMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 3. Prepare data for Cash Payment Method (Gpay vs Hand Cash)
  let totalHandSales = 0;
  let totalGpaySales = 0;
  logs.forEach((log) => {
    totalHandSales += log.cashDetails.handSales;
    totalGpaySales += log.cashDetails.gpaySales;
  });

  const paymentMixData = [
    { name: 'Hand Cash', value: totalHandSales },
    { name: 'GPay/UPI', value: totalGpaySales },
  ].filter(item => item.value > 0);

  const PIE_COLORS = ['#3b82f6', '#10b981'];

  // Overall Business KPIs
  const totalSalesAllTime = totalHandSales + totalGpaySales;
  const totalExpensesAllTime = logs.reduce(
    (acc, log) => acc + log.expenses.reduce((sum, e) => sum + e.amount, 0),
    0
  );
  const totalProfitAllTime = totalSalesAllTime - totalExpensesAllTime;
  const avgDailySales = logs.length > 0 ? totalSalesAllTime / logs.length : 0;

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
        <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-3">
          <BarChart2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-display font-bold text-slate-900">Analytics are Loading</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto mt-2">
          Keep logging your stock and cash entries daily. Analytics and financial performance charts will appear here automatically!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Total Sales */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              All-Time Sales
            </span>
            <span className="text-2xl font-extrabold font-mono text-slate-900 block">
              ₹{totalSalesAllTime.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Over {logs.length} day(s)
            </span>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-xs">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        {/* KPI: Total Expenses */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              All-Time Expenses
            </span>
            <span className="text-2xl font-extrabold font-mono text-slate-900 block">
              ₹{totalExpensesAllTime.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">Total operational payouts</span>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* KPI: Net Profit */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Net Profit
            </span>
            <span className={`text-2xl font-extrabold font-mono block ${
              totalProfitAllTime >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              ₹{totalProfitAllTime.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">Calculated net margins</span>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-xs ${
            totalProfitAllTime >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* KPI: Daily Average */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Daily Avg. Sales
            </span>
            <span className="text-2xl font-extrabold font-mono text-slate-900 block">
              ₹{avgDailySales.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">Average sales velocity</span>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-xs">
            <BarChart2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales vs Expenses Trend */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm lg:col-span-8">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4">
            Sales, Expenses, & Profit Trend
          </h3>
          <div className="h-72 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', fontFamily: 'monospace' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                  <Area type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
                  <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#profitGrad)" />
                  <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={1.5} fill={false} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Not enough data to display trend
              </div>
            )}
          </div>
        </div>

        {/* Payment Mix Distribution */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm lg:col-span-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4">
              Sales Payment Method
            </h3>
            <div className="h-56 w-full flex items-center justify-center relative">
              {paymentMixData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentMixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`₹${parseFloat(value).toFixed(2)}`, 'Sales']}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', fontFamily: 'monospace' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-xs text-center">No sales logged yet</div>
              )}
              {/* Centered Total */}
              {paymentMixData.length > 0 && (
                <div className="absolute text-center">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</span>
                  <span className="text-lg font-bold font-mono text-slate-900">₹{totalSalesAllTime.toFixed(0)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 block"></span>
                <span className="text-slate-600 font-medium">Hand Cash</span>
              </div>
              <span className="font-mono font-semibold text-slate-800">
                ₹{totalHandSales.toFixed(2)} ({totalSalesAllTime > 0 ? ((totalHandSales / totalSalesAllTime) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 block"></span>
                <span className="text-slate-600 font-medium">GPay/UPI</span>
              </div>
              <span className="font-mono font-semibold text-slate-800">
                ₹{totalGpaySales.toFixed(2)} ({totalSalesAllTime > 0 ? ((totalGpaySales / totalSalesAllTime) * 100).toFixed(0) : 0}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Item Sales Volume */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4">
          All-Time Sales Volume by Item
        </h3>
        <div className="h-64 w-full">
          {itemVolumeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemVolumeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(value: any) => [value, 'Units Sold']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              No item sales data to display
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
