/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DailyLog, MasterItem, ExpenseLog } from '../types';
import { DEFAULT_ITEMS } from '../constants';
import { generateExcelHTML } from './excel';

const MASTER_ITEMS_KEY = 'stock_cash_ledger_items';
const DAILY_LOGS_KEY_PREFIX = 'stock_cash_ledger_log_';
const LOG_INDEX_KEY = 'stock_cash_ledger_log_index';

// Fetch all master items
export function getMasterItems(): MasterItem[] {
  try {
    const data = localStorage.getItem(MASTER_ITEMS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading master items from localStorage:', e);
  }
  
  // Initialize default items if not present
  saveMasterItems(DEFAULT_ITEMS);
  return DEFAULT_ITEMS;
}

// Save master items
export function saveMasterItems(items: MasterItem[]): void {
  try {
    localStorage.setItem(MASTER_ITEMS_KEY, JSON.stringify(items));
    
    // Sync to Cloud Firestore asynchronously
    import('../lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, setDoc }) => {
        items.forEach((item) => {
          setDoc(doc(db, 'masterItems', item.id), item).catch(err => {
            console.error('[Firebase Sync] Error saving master item:', err);
          });
        });
      });
    }).catch(() => {});
  } catch (e) {
    console.error('Error saving master items to localStorage:', e);
  }
}

// Get index of all dates that have logs
export function getLogDates(): string[] {
  try {
    const data = localStorage.getItem(LOG_INDEX_KEY);
    if (data) {
      const dates: string[] = JSON.parse(data);
      return dates.sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)
    }
  } catch (e) {
    console.error('Error reading log index:', e);
  }
  return [];
}

// Add a date to the index
function addDateToIndex(date: string): void {
  const dates = getLogDates();
  if (!dates.includes(date)) {
    dates.push(date);
    try {
      localStorage.setItem(LOG_INDEX_KEY, JSON.stringify(dates));
    } catch (e) {
      console.error('Error updating log index:', e);
    }
  }
}

// Find the most recent daily log before a specific date
export function getPreviousDayLog(date: string): DailyLog | null {
  const dates = getLogDates();
  // Filter for dates before the given date and sort descending (newest first)
  const previousDates = dates
    .filter((d) => d < date)
    .sort((a, b) => b.localeCompare(a));
  
  if (previousDates.length > 0) {
    return getDailyLog(previousDates[0]);
  }
  return null;
}

// Fetch daily log for a specific date (or initialize a new one)
export function getDailyLog(date: string): DailyLog {
  const key = `${DAILY_LOGS_KEY_PREFIX}${date}`;
  try {
    const data = localStorage.getItem(key);
    if (data) {
      const log: DailyLog = JSON.parse(data);
      return log;
    }
  } catch (e) {
    console.error(`Error reading daily log for ${date}:`, e);
  }

  // If no log exists, initialize one.
  // We can attempt to pull opening stock from the previous day's balance!
  const masterItems = getMasterItems();
  const previousLog = getPreviousDayLog(date);

  const stockItems = masterItems.map((item) => {
    // Check if there is a previous day's balance to carry over
    const prevItem = previousLog?.stockItems.find((prev) => prev.itemId === item.id);
    const openStock = prevItem ? prevItem.balanceStock : item.defaultOpenStock;

    return {
      itemId: item.id,
      itemName: item.name,
      openStock,
      refillStock: 0,
      balanceStock: openStock, // Default balance same as open stock
      salesCount: 0,
      itemPrice: item.defaultPrice,
    };
  });

  const newLog: DailyLog = {
    id: date,
    date,
    stockItems,
    cashDetails: {
      morningOpening: previousLog ? previousLog.cashDetails.nightClosing : 0, // Carry over night closing cash as morning opening!
      nightClosing: 0,
      gpaySales: 0,
      handSales: 0,
    },
    expenses: [],
    notes: '',
    isCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDailyLog(newLog);
  return newLog;
}

// Save daily log
export function saveDailyLog(log: DailyLog): void {
  const key = `${DAILY_LOGS_KEY_PREFIX}${log.date}`;
  try {
    log.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(log));
    
    // Also save in excel format in localStorage with centrally aligned digits
    const excelHtml = generateExcelHTML(log);
    localStorage.setItem(`excel_ledger_export_${log.date}`, excelHtml);
    
    addDateToIndex(log.date);

    // Sync to Cloud Firestore asynchronously
    import('../lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, setDoc }) => {
        const logObj = JSON.parse(JSON.stringify(log));
        setDoc(doc(db, 'dailyLogs', log.date), logObj).catch(err => {
          console.error('[Firebase Sync] Error saving daily log:', err);
        });
      });
    }).catch(() => {});
  } catch (e) {
    console.error(`Error saving daily log for ${log.date}:`, e);
  }
}

// Delete a daily log
export function deleteDailyLog(date: string): void {
  const key = `${DAILY_LOGS_KEY_PREFIX}${date}`;
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(`excel_ledger_export_${date}`);
    const dates = getLogDates();
    const updatedDates = dates.filter((d) => d !== date);
    localStorage.setItem(LOG_INDEX_KEY, JSON.stringify(updatedDates));

    // Delete from Cloud Firestore asynchronously
    import('../lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, deleteDoc }) => {
        deleteDoc(doc(db, 'dailyLogs', date)).catch(err => {
          console.error('[Firebase Sync] Error deleting daily log:', err);
        });
      });
    }).catch(() => {});
  } catch (e) {
    console.error(`Error deleting daily log for ${date}:`, e);
  }
}

// Fetch all saved daily logs
export function getAllDailyLogs(): DailyLog[] {
  const dates = getLogDates();
  return dates
    .map((date) => getDailyLog(date))
    .sort((a, b) => b.date.localeCompare(a.date)); // Newest first
}

// Import all logs from a JSON backup with merge capability to avoid duplicate content and update stock lists
export function importLogsBackup(jsonData: string): { success: boolean; message: string } {
  try {
    const data = JSON.parse(jsonData);
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Invalid file format.' };
    }

    // 1. Merge Master Items (prevent duplicate content by id/name)
    let currentMasterItems = getMasterItems();
    let importedMasterCount = 0;
    let updatedMasterCount = 0;

    if (data.masterItems && Array.isArray(data.masterItems)) {
      data.masterItems.forEach((importedItem: any) => {
        if (!importedItem.id || !importedItem.name) return;
        
        // Find match by ID or by Name (case-insensitive)
        const matchIdx = currentMasterItems.findIndex(
          (existing) => 
            existing.id === importedItem.id || 
            existing.name.trim().toLowerCase() === importedItem.name.trim().toLowerCase()
        );

        if (matchIdx > -1) {
          // Update existing item with imported data
          currentMasterItems[matchIdx] = {
            ...currentMasterItems[matchIdx],
            id: currentMasterItems[matchIdx].id || importedItem.id,
            name: importedItem.name,
            defaultPrice: Number(importedItem.defaultPrice) || currentMasterItems[matchIdx].defaultPrice,
            defaultOpenStock: Number(importedItem.defaultOpenStock) || currentMasterItems[matchIdx].defaultOpenStock,
          };
          updatedMasterCount++;
        } else {
          // Add new master item
          currentMasterItems.push({
            id: importedItem.id,
            name: importedItem.name,
            defaultPrice: Number(importedItem.defaultPrice) || 0,
            defaultOpenStock: Number(importedItem.defaultOpenStock) || 0,
          });
          importedMasterCount++;
        }
      });
      saveMasterItems(currentMasterItems);
    }

    // 2. Merge Daily Logs
    let importedLogCount = 0;
    let updatedLogCount = 0;

    if (data.dailyLogs && typeof data.dailyLogs === 'object') {
      const existingDates = getLogDates();
      const updatedDatesSet = new Set(existingDates);

      Object.entries(data.dailyLogs).forEach(([date, logDataAny]) => {
        const importedLog = logDataAny as any;
        if (!importedLog || typeof importedLog !== 'object') return;

        const key = `${DAILY_LOGS_KEY_PREFIX}${date}`;
        const existingLogStr = localStorage.getItem(key);

        if (existingLogStr) {
          // Merge with existing log to prevent duplicate rows inside logs
          try {
            const existingLog = JSON.parse(existingLogStr) as DailyLog;

            // Merge stockItems array, deduplicating on itemId and itemName (case-insensitive)
            const mergedStockItems = [...(existingLog.stockItems || [])];
            if (importedLog.stockItems && Array.isArray(importedLog.stockItems)) {
              importedLog.stockItems.forEach((importedStock: any) => {
                const matchIdx = mergedStockItems.findIndex(
                  (s) =>
                    s.itemId === importedStock.itemId ||
                    s.itemName.trim().toLowerCase() === importedStock.itemName.trim().toLowerCase()
                );

                if (matchIdx > -1) {
                  // Merge values - imported takes precedence
                  mergedStockItems[matchIdx] = {
                    ...mergedStockItems[matchIdx],
                    itemName: importedStock.itemName,
                    openStock: importedStock.openStock !== undefined ? importedStock.openStock : mergedStockItems[matchIdx].openStock,
                    refillStock: importedStock.refillStock !== undefined ? importedStock.refillStock : mergedStockItems[matchIdx].refillStock,
                    balanceStock: importedStock.balanceStock !== undefined ? importedStock.balanceStock : mergedStockItems[matchIdx].balanceStock,
                    salesCount: importedStock.salesCount !== undefined ? importedStock.salesCount : mergedStockItems[matchIdx].salesCount,
                    itemPrice: importedStock.itemPrice || mergedStockItems[matchIdx].itemPrice,
                  };
                } else {
                  // Add new stock item
                  mergedStockItems.push({
                    itemId: importedStock.itemId,
                    itemName: importedStock.itemName,
                    openStock: importedStock.openStock || 0,
                    refillStock: importedStock.refillStock || 0,
                    balanceStock: importedStock.balanceStock || 0,
                    salesCount: importedStock.salesCount || 0,
                    itemPrice: importedStock.itemPrice || 0,
                  });
                }
              });
            }

            // Merge Cash Details
            const mergedCashDetails = {
              morningOpening: importedLog.cashDetails?.morningOpening !== undefined ? importedLog.cashDetails.morningOpening : (existingLog.cashDetails?.morningOpening || 0),
              nightClosing: importedLog.cashDetails?.nightClosing !== undefined ? importedLog.cashDetails.nightClosing : (existingLog.cashDetails?.nightClosing || 0),
              gpaySales: importedLog.cashDetails?.gpaySales !== undefined ? importedLog.cashDetails.gpaySales : (existingLog.cashDetails?.gpaySales || 0),
              handSales: importedLog.cashDetails?.handSales !== undefined ? importedLog.cashDetails.handSales : (existingLog.cashDetails?.handSales || 0),
            };

            // Merge Expenses
            const mergedExpenses = [...(existingLog.expenses || [])];
            if (importedLog.expenses && Array.isArray(importedLog.expenses)) {
              importedLog.expenses.forEach((importedExpense: any) => {
                const matchIdx = mergedExpenses.findIndex((e) => e.id === importedExpense.id);
                if (matchIdx > -1) {
                  mergedExpenses[matchIdx] = {
                    ...mergedExpenses[matchIdx],
                    category: importedExpense.category || mergedExpenses[matchIdx].category,
                    amount: importedExpense.amount !== undefined ? importedExpense.amount : mergedExpenses[matchIdx].amount,
                    description: importedExpense.description !== undefined ? importedExpense.description : mergedExpenses[matchIdx].description,
                    paymentMethod: importedExpense.paymentMethod || mergedExpenses[matchIdx].paymentMethod,
                  };
                } else {
                  mergedExpenses.push({
                    id: importedExpense.id,
                    category: importedExpense.category || 'Others',
                    amount: importedExpense.amount || 0,
                    description: importedExpense.description || '',
                    paymentMethod: importedExpense.paymentMethod || 'cash',
                  });
                }
              });
            }

            const mergedLog: DailyLog = {
              id: existingLog.id || importedLog.id || date,
              date: date,
              stockItems: mergedStockItems,
              cashDetails: mergedCashDetails,
              expenses: mergedExpenses,
              notes: importedLog.notes || existingLog.notes || '',
              isCompleted: importedLog.isCompleted !== undefined ? importedLog.isCompleted : existingLog.isCompleted,
              createdAt: existingLog.createdAt || importedLog.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            localStorage.setItem(key, JSON.stringify(mergedLog));
            // Ensure excel central view is also updated
            const excelHtml = generateExcelHTML(mergedLog);
            localStorage.setItem(`excel_ledger_export_${date}`, excelHtml);

            updatedLogCount++;
          } catch (e) {
            console.error(`Error merging log for date ${date}:`, e);
          }
        } else {
          // Completely new daily log date
          localStorage.setItem(key, JSON.stringify(importedLog));
          const excelHtml = generateExcelHTML(importedLog);
          localStorage.setItem(`excel_ledger_export_${date}`, excelHtml);
          updatedDatesSet.add(date);
          importedLogCount++;
        }
      });

      // Update index
      const finalDates = Array.from(updatedDatesSet).sort((a, b) => b.localeCompare(a));
      localStorage.setItem(LOG_INDEX_KEY, JSON.stringify(finalDates));

      let message = 'Import complete: ';
      if (importedMasterCount > 0 || updatedMasterCount > 0) {
        message += `Catalog merged (${importedMasterCount} new, ${updatedMasterCount} updated). `;
      }
      message += `Daily logs merged (${importedLogCount} new, ${updatedLogCount} updated).`;

      return { success: true, message };
    }

    if (importedMasterCount > 0 || updatedMasterCount > 0) {
      return { 
        success: true, 
        message: `Catalog merged successfully (${importedMasterCount} new, ${updatedMasterCount} updated).` 
      };
    }

    return { success: false, message: 'No valid daily logs or items found in the file.' };
  } catch (e) {
    return { success: false, message: 'Failed to parse JSON backup file.' };
  }
}

// Export all logs as a JSON backup
export function exportLogsBackup(): string {
  const items = getMasterItems();
  const dates = getLogDates();
  const dailyLogs: { [date: string]: DailyLog } = {};
  
  dates.forEach((date) => {
    dailyLogs[date] = getDailyLog(date);
  });

  const backupData = {
    exportDate: new Date().toISOString(),
    masterItems: items,
    dailyLogs,
  };

  return JSON.stringify(backupData, null, 2);
}
