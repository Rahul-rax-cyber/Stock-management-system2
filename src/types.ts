/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MasterItem {
  id: string;
  name: string;
  defaultPrice: number;
  defaultOpenStock: number;
}

export interface StockItemLog {
  itemId: string;
  itemName: string;
  openStock: number;
  refillStock: number;
  balanceStock: number;
  salesCount: number;
  itemPrice: number;
}

export interface CashDetailsLog {
  morningOpening: number;
  nightClosing: number;
  gpaySales: number;
  handSales: number;
}

export interface ExpenseLog {
  id: string;
  category: string; // 'Rent', 'Manpower', 'EB Bill', 'Petrol', 'Others'
  amount: number;
  description: string;
  paymentMethod: 'cash' | 'gpay';
}

export interface DailyLog {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  stockItems: StockItemLog[];
  cashDetails: CashDetailsLog;
  expenses: ExpenseLog[];
  notes: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isSystem: boolean; // default pre-defined ones
}
