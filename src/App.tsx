/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { DailyLog, MasterItem, StockItemLog, CashDetailsLog, ExpenseLog } from './types';
import {
  getDailyLog,
  saveDailyLog,
  getMasterItems,
  saveMasterItems,
  getLogDates,
  getPreviousDayLog,
  exportLogsBackup,
  importLogsBackup,
} from './utils/storage';
import { StockSection } from './components/StockSection';
import { CashSection } from './components/CashSection';
import { ExpenseSection } from './components/ExpenseSection';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { ManageItemsModal } from './components/ManageItemsModal';
import { AIChatbot } from './components/AIChatbot';
import { BackupManagerModal } from './components/BackupManagerModal';
import { generateExcelHTML } from './utils/excel';
import { pullAndMergeCloudData } from './utils/firebaseSync';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Download,
  Upload,
  Settings,
  Lock,
  Unlock,
  Plus,
  Trash2,
  FileText,
  PieChart as ChartIcon,
  RefreshCw,
  Coins,
  IndianRupee,
  Briefcase,
  AlertCircle,
  TrendingDown,
  LogOut,
  Menu,
  X,
  Database,
} from 'lucide-react';

const getTodayString = () => new Date().toLocaleDateString('en-CA');

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics'>('ledger');
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [logDates, setLogDates] = useState<string[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [firebaseSyncStatus, setFirebaseSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load master items and date index on boot
  useEffect(() => {
    const items = getMasterItems();
    setMasterItems(items);
    setLogDates(getLogDates());

    // Pull and sync from Cloud Firestore on mount
    setFirebaseSyncStatus('syncing');
    pullAndMergeCloudData()
      .then((res) => {
        if (res.success) {
          setFirebaseSyncStatus('synced');
          // Reload states after cloud values are successfully merged
          setMasterItems(getMasterItems());
          setLogDates(getLogDates());
          setCurrentLog(getDailyLog(selectedDate));
        } else {
          setFirebaseSyncStatus('error');
        }
      })
      .catch((err) => {
        console.error('[Firebase Sync Error]', err);
        setFirebaseSyncStatus('error');
      });
  }, []);

  // Load log whenever selectedDate changes
  useEffect(() => {
    const log = getDailyLog(selectedDate);
    setCurrentLog(log);
    setLogDates(getLogDates());
  }, [selectedDate]);

  // Handle stock items changes
  const handleStockChange = (updatedStock: StockItemLog[]) => {
    if (!currentLog) return;
    const updated = { ...currentLog, stockItems: updatedStock };
    setCurrentLog(updated);
    saveDailyLog(updated);
  };

  // Handle cash details changes
  const handleCashChange = (updatedCash: CashDetailsLog) => {
    if (!currentLog) return;
    const updated = { ...currentLog, cashDetails: updatedCash };
    setCurrentLog(updated);
    saveDailyLog(updated);
  };

  // Handle expenses changes
  const handleExpensesChange = (updatedExpenses: ExpenseLog[]) => {
    if (!currentLog) return;
    const updated = { ...currentLog, expenses: updatedExpenses };
    setCurrentLog(updated);
    saveDailyLog(updated);
  };

  // Handle notes changes
  const handleNotesChange = (notes: string) => {
    if (!currentLog) return;
    const updated = { ...currentLog, notes };
    setCurrentLog(updated);
    saveDailyLog(updated);
  };

  // Toggle completion / closing of the day
  const handleToggleCompleted = () => {
    if (!currentLog) return;
    const updated = { ...currentLog, isCompleted: !currentLog.isCompleted };
    setCurrentLog(updated);
    saveDailyLog(updated);
  };

  // Pre-fill opening stock from previous logged day
  const handlePreFillBalances = () => {
    if (!currentLog) return;
    const prevLog = getPreviousDayLog(selectedDate);
    if (!prevLog) {
      alert('No previous logged day found to carry over balances.');
      return;
    }

    const updatedStock = currentLog.stockItems.map((item) => {
      const prevItem = prevLog.stockItems.find((p) => p.itemId === item.itemId);
      const prevBalance = prevItem ? prevItem.balanceStock : item.openStock;
      
      const totalStock = prevBalance + item.refillStock;
      const salesCount = Math.max(0, totalStock - item.balanceStock);

      return {
        ...item,
        openStock: prevBalance,
        salesCount,
      };
    });

    // Also carry over night closing cash as morning opening!
    const updatedCash = {
      ...currentLog.cashDetails,
      morningOpening: prevLog.cashDetails.nightClosing,
    };

    const updated = {
      ...currentLog,
      stockItems: updatedStock,
      cashDetails: updatedCash,
    };

    setCurrentLog(updated);
    saveDailyLog(updated);
    alert('Successfully carried over closing balances & cash from previous entry!');
  };

  // Manage master items
  const handleSaveMasterItems = (updatedItems: MasterItem[]) => {
    saveMasterItems(updatedItems);
    setMasterItems(updatedItems);

    // Sync current log's stock items
    if (currentLog) {
      const existingStockItems = currentLog.stockItems || [];
      // Remove items that are no longer in updatedItems (deleted)
      let updatedStockItems = existingStockItems.filter((existingItem) =>
        updatedItems.some((item) => item.id === existingItem.itemId)
      );

      // Add any new items or update existing item metadata
      updatedItems.forEach((item) => {
        const existingIdx = updatedStockItems.findIndex((s) => s.itemId === item.id);
        if (existingIdx > -1) {
          // Update details for existing item
          updatedStockItems[existingIdx] = {
            ...updatedStockItems[existingIdx],
            itemName: item.name,
            itemPrice: item.defaultPrice,
          };
        } else {
          // Add new item
          updatedStockItems.push({
            itemId: item.id,
            itemName: item.name,
            openStock: item.defaultOpenStock,
            refillStock: 0,
            balanceStock: item.defaultOpenStock,
            salesCount: 0,
            itemPrice: item.defaultPrice,
          });
        }
      });

      const updatedLog = {
        ...currentLog,
        stockItems: updatedStockItems,
      };
      setCurrentLog(updatedLog);
      saveDailyLog(updatedLog);
    }
  };

  // Backup Export
  const handleExportBackup = () => {
    const backupStr = exportLogsBackup();
    const blob = new Blob([backupStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger-backup-${new Date().toLocaleDateString('en-CA')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download Excel Spreadsheet
  const handleDownloadExcel = () => {
    if (!currentLog) return;
    const excelContent = generateExcelHTML(currentLog);
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger-report-${selectedDate}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Backup Import
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const resultStr = event.target?.result as string;
      const importResult = importLogsBackup(resultStr);
      if (importResult.success) {
        setImportStatus({ type: 'success', message: importResult.message });
        setMasterItems(getMasterItems());
        setLogDates(getLogDates());
        setCurrentLog(getDailyLog(selectedDate));
      } else {
        setImportStatus({ type: 'error', message: importResult.message });
      }

      // Clear flash message after 5 seconds
      setTimeout(() => {
        setImportStatus(null);
      }, 5000);
    };
    reader.readAsText(file);
    // Clear input
    e.target.value = '';
  };

  // Shift selected date by delta days
  const handleShiftDate = (days: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(currentDate.toLocaleDateString('en-CA'));
  };

  // Clear all data
  const handleResetApp = () => {
    if (confirm('CRITICAL WARNING: This will permanently delete all daily logs, stock records, and configurations from your browser. This action is irreversible. Proceed?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Math totals for summary card
  const getDailyProfitMetrics = () => {
    if (!currentLog) return { totalSales: 0, totalExpenses: 0, netProfit: 0, stockRevenue: 0 };
    
    // Physical/recorded Sales: Hand Cash + GPay
    const totalSales = currentLog.cashDetails.handSales + currentLog.cashDetails.gpaySales;
    
    // Stock-Calculated Revenue: Sum of (salesCount * itemPrice)
    const stockRevenue = currentLog.stockItems.reduce((acc, item) => acc + item.salesCount * item.itemPrice, 0);
    
    // Total Expenses
    const totalExpenses = currentLog.expenses.reduce((acc, e) => acc + e.amount, 0);
    
    // Net profit (using recorded sales)
    const netProfit = totalSales - totalExpenses;

    return { totalSales, totalExpenses, netProfit, stockRevenue };
  };

  const { totalSales, totalExpenses, netProfit, stockRevenue } = getDailyProfitMetrics();

  // Financial mismatch checks
  const salesDiscrepancy = Math.abs(stockRevenue - totalSales);
  const showSalesWarning = salesDiscrepancy > 0.01;

  const hasPrevDay = getPreviousDayLog(selectedDate) !== null;

  // Render Daily Dashboard Entry Screen
  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-blue-100">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col text-white shrink-0 shadow-2xl hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-lg text-white">S</div>
          <span className="text-xl font-semibold tracking-tight font-display">LedgerHub</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <div
            onClick={() => setActiveTab('ledger')}
            className={`p-3 rounded-xl flex items-center space-x-3 cursor-pointer transition-colors ${
              activeTab === 'ledger'
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <FileText className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium">Compliance Overview</span>
          </div>
          
          <div
            onClick={() => setActiveTab('analytics')}
            className={`p-3 rounded-xl flex items-center space-x-3 cursor-pointer transition-colors ${
              activeTab === 'analytics'
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <ChartIcon className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium">Digital Audits</span>
          </div>

          <div
            onClick={() => setIsManageModalOpen(true)}
            className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-slate-400 transition-colors"
          >
            <Settings className="w-5 h-5 opacity-80" />
            <span className="text-sm">Manage Catalog</span>
          </div>

          <div className="h-px bg-slate-800 my-4" />

          <p className="px-3 text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Backups & Exports</p>

          <div
            onClick={() => setIsBackupModalOpen(true)}
            className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-indigo-300 bg-indigo-500/5 border border-indigo-500/10 transition-colors"
            title="Cloud Backup History & Secure Restore"
          >
            <Database className="w-5 h-5 text-indigo-400 opacity-80 animate-pulse" />
            <span className="text-sm font-semibold">Backend Backups</span>
          </div>

          <div
            onClick={handleDownloadExcel}
            className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-slate-400 transition-colors"
            title="Download Excel Report"
          >
            <FileText className="w-5 h-5 text-emerald-500 opacity-80" />
            <span className="text-sm">Download Excel</span>
          </div>

          <div
            onClick={handleExportBackup}
            className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-slate-400 transition-colors"
            title="Export JSON Backup"
          >
            <Download className="w-5 h-5 opacity-80" />
            <span className="text-sm">Export Data</span>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-slate-400 transition-colors"
            title="Import JSON Backup"
          >
            <Upload className="w-5 h-5 opacity-80" />
            <span className="text-sm">Import Data</span>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportBackup}
            accept="application/json"
            className="hidden"
          />
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="bg-slate-800 p-4 rounded-xl space-y-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Project Status</p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-xs font-semibold text-slate-200">System Live v2.4.0</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-750">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Firebase Sync</p>
              <div className="flex items-center space-x-2">
                {firebaseSyncStatus === 'syncing' ? (
                  <>
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></div>
                    <p className="text-xs font-semibold text-amber-400">Syncing database...</p>
                  </>
                ) : firebaseSyncStatus === 'synced' ? (
                  <>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]"></div>
                    <p className="text-xs font-semibold text-emerald-400">Cloud Connected ☁️</p>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                    <p className="text-xs font-semibold text-rose-400">Sync Offline / Error</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar overlay & drawer */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col shadow-2xl md:hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-lg text-white">S</div>
                  <span className="text-xl font-semibold tracking-tight font-display">LedgerHub</span>
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <nav className="flex-1 p-4 space-y-2">
                <div
                  onClick={() => { setActiveTab('ledger'); setIsMobileSidebarOpen(false); }}
                  className={`p-3 rounded-xl flex items-center space-x-3 cursor-pointer transition-colors ${
                    activeTab === 'ledger'
                      ? 'bg-blue-600/20 text-blue-400 font-medium'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <FileText className="w-5 h-5 opacity-80" />
                  <span className="text-sm font-medium">Compliance Overview</span>
                </div>
                
                <div
                  onClick={() => { setActiveTab('analytics'); setIsMobileSidebarOpen(false); }}
                  className={`p-3 rounded-xl flex items-center space-x-3 cursor-pointer transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-blue-600/20 text-blue-400 font-medium'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <ChartIcon className="w-5 h-5 opacity-80" />
                  <span className="text-sm font-medium">Digital Audits</span>
                </div>

                <div
                  onClick={() => { setIsManageModalOpen(true); setIsMobileSidebarOpen(false); }}
                  className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-slate-400 transition-colors"
                >
                  <Settings className="w-5 h-5 opacity-80" />
                  <span className="text-sm">Manage Catalog</span>
                </div>

                <div className="h-px bg-slate-800 my-4" />

                <div
                  onClick={() => { setIsBackupModalOpen(true); setIsMobileSidebarOpen(false); }}
                  className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-indigo-300 bg-indigo-500/5 border border-indigo-500/10 transition-colors animate-pulse"
                >
                  <Database className="w-5 h-5 text-indigo-400 opacity-80" />
                  <span className="text-sm font-semibold">Backend Backups</span>
                </div>

                <div
                  onClick={() => { handleDownloadExcel(); setIsMobileSidebarOpen(false); }}
                  className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-slate-400 transition-colors"
                >
                  <FileText className="w-5 h-5 text-emerald-500 opacity-80" />
                  <span className="text-sm">Download Excel</span>
                </div>

                <div
                  onClick={() => { handleExportBackup(); setIsMobileSidebarOpen(false); }}
                  className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-slate-400 transition-colors"
                >
                  <Download className="w-5 h-5 opacity-80" />
                  <span className="text-sm">Export Backup</span>
                </div>

                <div
                  onClick={() => { fileInputRef.current?.click(); setIsMobileSidebarOpen(false); }}
                  className="hover:bg-slate-800 p-3 rounded-xl flex items-center space-x-3 cursor-pointer text-slate-400 transition-colors"
                >
                  <Upload className="w-5 h-5 opacity-80" />
                  <span className="text-sm">Import Backup</span>
                </div>
              </nav>

              <div className="p-6 border-t border-slate-800">
                <div className="bg-slate-800 p-4 rounded-xl space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Project Status</p>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <p className="text-xs font-semibold text-slate-200">System Live v2.4.0</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-750">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Firebase Sync</p>
                    <div className="flex items-center space-x-2">
                      {firebaseSyncStatus === 'syncing' ? (
                        <>
                          <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></div>
                          <p className="text-xs font-semibold text-amber-400">Syncing database...</p>
                        </>
                      ) : firebaseSyncStatus === 'synced' ? (
                        <>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]"></div>
                          <p className="text-xs font-semibold text-emerald-400">Cloud Connected ☁️</p>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                          <p className="text-xs font-semibold text-rose-400">Sync Offline / Error</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Main Header bar */}
        <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 font-display">
                {activeTab === 'ledger' ? 'Stock Management System' : 'Analytics Intelligence'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium italic">
                {activeTab === 'ledger' ? `Last edited for date: ${selectedDate}` : 'Historical ledger analytics logs'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex space-x-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                currentLog?.isCompleted ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
              }`}>
                {currentLog?.isCompleted ? 'Closed & Sealed' : 'Active Worksheet'}
              </span>
              <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                Ledger Core
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-md flex items-center justify-center font-bold text-slate-700 font-display">
              U
            </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-slate-50">
          
          {/* Flash Backup Messages */}
          {importStatus && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold border ${
                importStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100 shadow-sm'
                  : 'bg-rose-50 text-rose-800 border-rose-100 shadow-sm'
              }`}
            >
              {importStatus.message}
            </div>
          )}

          {/* Controller HUD & Date Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-100 shadow-sm p-5 rounded-3xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShiftDate(-1)}
                className="p-2.5 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-600 transition-colors focus:outline-none"
                aria-label="Go to previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-9 pr-3 py-2 font-semibold text-slate-800 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-sm focus:outline-none focus:border-blue-500"
                  aria-label="Select Date"
                />
              </div>

              <button
                onClick={() => handleShiftDate(1)}
                className="p-2.5 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-600 transition-colors focus:outline-none"
                aria-label="Go to next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {selectedDate !== getTodayString() && (
                <button
                  onClick={() => setSelectedDate(getTodayString())}
                  className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
                >
                  Today
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all border border-emerald-500 shadow-sm cursor-pointer"
                title="Download current day ledger in Excel format with centrally aligned digits"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel (Centred)
              </button>

              {currentLog?.isCompleted ? (
                <button
                  onClick={handleToggleCompleted}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all border border-rose-100"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Closed Ledger
                </button>
              ) : (
                <button
                  onClick={handleToggleCompleted}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Active (Editing)
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Tab Switch Stage */}
          <AnimatePresence mode="wait">
            {activeTab === 'ledger' && currentLog ? (
              <motion.div
                key="ledger-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-8"
              >
                {/* Sleek Layout matching Overview cards */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* High impact Global Score estimated financials box */}
                  <div className="lg:col-span-8 bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-100 flex flex-col justify-between text-white min-h-[190px] relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                    
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="opacity-80 text-[10px] font-bold uppercase tracking-widest">Global Overview</span>
                        <h3 className="text-xl font-bold font-display tracking-tight">Financial Performance Metric</h3>
                      </div>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                        Live Sync
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 my-4">
                      <div>
                        <span className="opacity-80 text-[10px] font-semibold uppercase tracking-wider block">Total Sales</span>
                        <span className="text-2xl font-extrabold font-mono text-white mt-0.5 block">₹{totalSales.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="opacity-80 text-[10px] font-semibold uppercase tracking-wider block">Expenses</span>
                        <span className="text-2xl font-extrabold font-mono text-white mt-0.5 block">₹{totalExpenses.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="opacity-80 text-[10px] font-semibold uppercase tracking-wider block">Calculated Profit</span>
                        <span className="text-2xl font-extrabold font-mono mt-0.5 block text-white underline decoration-2 decoration-emerald-300">
                          ₹{netProfit.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="opacity-80 text-[10px] font-semibold uppercase tracking-wider block">Retail Sold</span>
                        <span className="text-2xl font-extrabold font-mono text-white mt-0.5 block">₹{stockRevenue.toFixed(2)}</span>
                      </div>
                    </div>

                    <p className="text-[11px] opacity-80 italic">
                      * Calculation: Sales counts of items sold retail valuation versus physical register drawer cash deposits.
                    </p>
                  </div>

                  {/* Sleek Audit Suggestion box */}
                  <div className="lg:col-span-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[190px]">
                    <div>
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Audit Advisor</h4>
                      
                      {showSalesWarning ? (
                        <div className="space-y-2">
                          <div className="flex gap-2.5 text-rose-600">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-xs font-bold block">Discrepancy Warning</span>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                There is a mismatch of <strong className="font-mono text-rose-600">₹{salesDiscrepancy.toFixed(2)}</strong> between computed inventory sold (₹{stockRevenue.toFixed(2)}) and physical cash inputs (₹{totalSales.toFixed(2)}).
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2.5 text-emerald-600">
                          <AlertCircle className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold block">System Reconciliation Match</span>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              Your reported cash and UPI receipts perfectly match the calculated product inventory drawdown. Perfect balance!
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => {
                        if (showSalesWarning) {
                          alert(`Please adjust either physical sale entries or stock balance counts to resolve the ₹${salesDiscrepancy.toFixed(2)} difference.`);
                        } else {
                          alert('Awesome! Registers are in perfect alignment today.');
                        }
                      }}
                      className="w-full bg-slate-900 text-white text-xs py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors mt-3"
                    >
                      Audit Details
                    </button>
                  </div>
                </div>

                {/* Locked/ReadOnly Overlay notification if Completed */}
                {currentLog.isCompleted && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-3xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold">This Daily Ledger is Sealed & Frozen</h4>
                        <p className="text-xs text-amber-700 mt-0.5">Values are preserved as read-only. Unlock this ledger from the controller above if modifications are required.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleToggleCompleted}
                      className="px-4 py-2 text-xs font-semibold text-amber-800 hover:text-white bg-white hover:bg-amber-600 border border-amber-300 rounded-xl transition-all shadow-xs"
                    >
                      Unlock Sheet
                    </button>
                  </div>
                )}

                {/* Grid content */}
                <div className={`space-y-8 ${currentLog.isCompleted ? 'pointer-events-none opacity-85' : ''}`}>
                  
                  {/* Section 1: Stock List details */}
                  <StockSection
                    stockItems={currentLog.stockItems}
                    onChange={handleStockChange}
                    onPreFillPrevBalance={handlePreFillBalances}
                    hasPrevDay={hasPrevDay}
                  />

                  {/* Section 2: Cash details & Reconciliation */}
                  <CashSection
                    cashDetails={currentLog.cashDetails}
                    expenses={currentLog.expenses}
                    onChange={handleCashChange}
                  />

                  {/* Section 3: Expense details */}
                  <ExpenseSection
                    expenses={currentLog.expenses}
                    onChange={handleExpensesChange}
                  />

                  {/* Section 4: Extra Daily Notes */}
                  <section className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <label htmlFor="daily-notes" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Daily Remarks & Operational Logs
                    </label>
                    <textarea
                      id="daily-notes"
                      value={currentLog.notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      placeholder="Record general remarks, credit customer diaries, weather impact, or custom stock details here..."
                      rows={3}
                      className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                    />
                  </section>
                </div>

                {/* Big Close the Day Trigger */}
                {!currentLog.isCompleted && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleToggleCompleted}
                      className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl transition-all shadow-md flex items-center gap-2.5 cursor-pointer transform hover:-translate-y-0.5"
                    >
                      <Lock className="w-4 h-4" />
                      Seal Current Worksheet & Lock Register
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              activeTab === 'analytics' && (
                <motion.div
                  key="analytics-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <DashboardAnalytics logs={logDates.map((d) => getDailyLog(d))} />
                </motion.div>
              )
            )}
          </AnimatePresence>

          {/* FOOTER */}
          <footer className="bg-white border-t border-slate-100 py-6 mt-16 text-center text-xs text-slate-400 rounded-3xl">
            <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="font-bold text-slate-500">LedgerHub Client Interface</span> — Professional high-contrast bookkeeping.
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleResetApp}
                  className="text-rose-500 hover:text-rose-700 font-semibold transition-colors cursor-pointer"
                  title="Clear all browser local storage data"
                >
                  Clear All System Data
                </button>
                <span className="text-slate-200">|</span>
                <span className="font-mono text-[11px] bg-slate-50 px-2 py-1 rounded">2026-06-29 Standard</span>
              </div>
            </div>
          </footer>

        </div>
      </main>

      {/* Catalog items settings modal overlay */}
      <ManageItemsModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        items={masterItems}
        onSave={handleSaveMasterItems}
      />

      {/* Multilingual AI Chatbot & Voice Assistant */}
      <AIChatbot
        ledgerState={{
          masterItems,
          currentLog,
          logDates,
          selectedDate
        }}
        onUpdateStock={handleStockChange}
        onAddExpense={(newExp) => {
          if (!currentLog) return;
          const updated = [...currentLog.expenses, newExp];
          handleExpensesChange(updated);
        }}
        onUpdateCash={handleCashChange}
        onNavigate={(tab) => {
          setActiveTab(tab);
        }}
        onOpenManageCatalog={() => {
          setIsManageModalOpen(true);
        }}
        onDownloadExcel={handleDownloadExcel}
      />

      {/* Backend-Powered Secure Backup & Restore Modal */}
      <BackupManagerModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onRestoreSuccess={() => {
          setMasterItems(getMasterItems());
          setLogDates(getLogDates());
          setCurrentLog(getDailyLog(selectedDate));
        }}
      />
    </div>
  );
}
