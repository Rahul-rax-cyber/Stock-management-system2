/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MasterItem, ExpenseCategory } from './types';

export const DEFAULT_ITEMS: MasterItem[] = [
  { id: 'item_a', name: 'A', defaultPrice: 10, defaultOpenStock: 0 },
  { id: 'item_b', name: 'B', defaultPrice: 15, defaultOpenStock: 0 },
  { id: 'item_c', name: 'C', defaultPrice: 20, defaultOpenStock: 0 },
  { id: 'item_d', name: 'D', defaultPrice: 25, defaultOpenStock: 0 },
  { id: 'item_e', name: 'E', defaultPrice: 30, defaultOpenStock: 0 },
  { id: 'item_f', name: 'F', defaultPrice: 40, defaultOpenStock: 0 },
  { id: 'item_soap', name: 'Soap', defaultPrice: 12, defaultOpenStock: 25 },
];

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'rent', name: 'Shop Rent', isSystem: true },
  { id: 'manpower', name: 'Manpower Cost', isSystem: true },
  { id: 'eb_bill', name: 'EB Bill', isSystem: true },
  { id: 'petrol', name: 'Petrol', isSystem: true },
  { id: 'others', name: 'Others', isSystem: true },
];
