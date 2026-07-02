/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Database,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  Share2,
  Shield,
  Upload,
  AlertTriangle,
  AlertCircle,
  FileJson,
  Loader2,
  ExternalLink,
  Mail,
  Send,
  MessageSquare,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyLog, MasterItem } from '../types';
import { getMasterItems, getLogDates, getDailyLog, importLogsBackup, exportLogsBackup } from '../utils/storage';

interface BackupLog {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  fileType: string;
  createdAt: string;
  version: string;
  checksum: string;
  createdBy: string;
  logs: string[];
}

interface BackupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export function BackupManagerModal({ isOpen, onClose, onRestoreSuccess }: BackupManagerModalProps) {
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<'Admin' | 'Manager' | 'Staff'>(() => {
    return (localStorage.getItem('ledgerhub_chat_role') as any) || 'Admin';
  });
  const [userEmail, setUserEmail] = useState('admin@ledgerhub.com');
  
  // Progress states
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<{
    steps: string[];
    currentStepIdx: number;
    isActive: boolean;
  }>({ steps: [], currentStepIdx: 0, isActive: false });

  // Share overlay state
  const [activeShare, setActiveShare] = useState<{
    backupId: string;
    filename: string;
    expiresAt: number;
    link: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // File drag & drop state
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load backups on mount
  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen]);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/backups', {
        headers: {
          'x-user-role': userRole
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      } else {
        console.error('Failed to load backup history');
      }
    } catch (e) {
      console.error('Error fetching backups:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a new backup on-demand from local storage
  const handleGenerateBackup = async () => {
    setIsLoading(true);
    try {
      const statePayload = exportLogsBackup();
      const response = await fetch('/api/backups/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payload: statePayload,
          userRole,
          userEmail
        })
      });

      if (response.status === 409) {
        alert('Duplicate backup payload detected. An identical backup file already exists on the server.');
        return;
      }

      if (response.ok) {
        alert('Encrypted backup successfully generated & stored on the secure backend server!');
        fetchBackups();
      } else {
        const err = await response.json();
        alert('Generation failed: ' + (err.error || 'Server error'));
      }
    } catch (e: any) {
      alert('Error communicating with backup backend: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload backup file via file reader
  const handleUploadFile = async (file: File) => {
    if (!file) return;

    // Validate format
    const isJson = file.name.endsWith('.json');
    const isZip = file.name.endsWith('.zip');
    const isEnc = file.name.endsWith('.enc');
    if (!isJson && !isZip && !isEnc) {
      alert('Unsupported file format. Please select a JSON, ZIP, or ENC encrypted backup file.');
      return;
    }

    // Set progress simulator
    setUploadProgress(10);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        setUploadProgress(50);
        const fileContent = e.target?.result as string;

        setUploadProgress(75);
        const response = await fetch('/api/backups/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: file.name,
            content: fileContent,
            fileType: isJson ? 'json' : isZip ? 'zip' : 'enc',
            userRole,
            userEmail
          })
        });

        if (response.status === 409) {
          alert('Upload cancelled: An identical backup payload already exists on the server (duplicate check failed).');
          setUploadProgress(null);
          return;
        }

        if (response.ok) {
          setUploadProgress(100);
          setTimeout(() => {
            alert('Backup file successfully encrypted and uploaded securely!');
            setUploadProgress(null);
            fetchBackups();
          }, 300);
        } else {
          const err = await response.json();
          alert('Upload failed: ' + (err.error || 'Server error'));
          setUploadProgress(null);
        }
      } catch (err: any) {
        alert('Upload reading error: ' + err.message);
        setUploadProgress(null);
      }
    };

    reader.readAsText(file);
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  // Restore and merge stored backup
  const handleRestoreBackup = async (id: string, originalName: string) => {
    if (!confirm(`WARNING: Are you absolutely sure you want to RESTORE the ledger state to "${originalName}"? This will replace or merge all stock records, cash logs, and catalog items with this backup.`)) {
      return;
    }

    setRestoreProgress({
      steps: [
        'Connecting to secure server...',
        'Decrypting AES encrypted file package...',
        'Verifying payload integrity & SHA checksum...',
        'Parsing database schemas...',
        'Merging master catalog items (avoiding duplicates)...',
        'Merging daily stock/ledger logs...',
        'Synchronizing with Google Firebase Firestore...'
      ],
      currentStepIdx: 0,
      isActive: true
    });

    try {
      // Simulate highly professional multi-step progress bar
      for (let i = 1; i <= 6; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setRestoreProgress(prev => ({ ...prev, currentStepIdx: i }));
      }

      const response = await fetch(`/api/backups/restore/${id}`, {
        headers: {
          'x-user-role': userRole
        }
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve decrypted restore package from server');
      }

      const resData = await response.json();
      const backupContentStr = JSON.stringify(resData.data);
      
      // Perform frontend restore merge
      const importResult = importLogsBackup(backupContentStr);
      
      if (!importResult.success) {
        throw new Error(importResult.message);
      }

      setRestoreProgress(prev => ({ ...prev, currentStepIdx: 7 }));
      await new Promise((resolve) => setTimeout(resolve, 600));

      alert('Database fully restored! ' + importResult.message);
      onRestoreSuccess();
      onClose();
    } catch (err: any) {
      alert('Restore failed: ' + err.message);
    } finally {
      setRestoreProgress({ steps: [], currentStepIdx: 0, isActive: false });
    }
  };

  // Delete stored backup
  const handleDeleteBackup = async (id: string) => {
    if (userRole !== 'Admin') {
      alert('Access Denied: Only Admin users are authorized to delete backup files on the server.');
      return;
    }

    if (!confirm('Are you sure you want to permanently delete this backup from the backend server? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/backups/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': userRole
        }
      });

      if (response.ok) {
        alert('Backup successfully deleted from backend storage.');
        fetchBackups();
      } else {
        const err = await response.json();
        alert('Deletion failed: ' + (err.error || 'Server error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // Secure download link sharing options
  const handleShareBackup = async (id: string, filename: string) => {
    try {
      const response = await fetch(`/api/backups/share/${id}`, {
        method: 'POST',
        headers: {
          'x-user-role': userRole
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Generate complete link using current origin
        const base = window.location.origin;
        const link = `${base}/api/backups/download/${id}?token=${data.token}&expires=${data.expiresAt}`;
        
        setActiveShare({
          backupId: id,
          filename,
          expiresAt: data.expiresAt,
          link
        });
      } else {
        alert('Failed to generate shared download link.');
      }
    } catch (e: any) {
      alert('Error sharing backup: ' + e.message);
    }
  };

  const handleCopyLink = () => {
    if (activeShare) {
      navigator.clipboard.writeText(activeShare.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Filter backup files
  const filteredBackups = backups.filter((b) =>
    b.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.createdBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header bar */}
        <div className="px-6 py-5 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Backend Backup Management System
              </h2>
              <p className="text-xs text-slate-400 font-mono">Secure, Encrypted Cloud Archives</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permissions / Role simulator strip */}
        <div className="px-6 py-3 bg-indigo-950/20 border-b border-slate-800/50 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold">Security Role Simulator:</span>
            <select
              value={userRole}
              onChange={(e) => {
                const r = e.target.value as any;
                setUserRole(r);
                localStorage.setItem('ledgerhub_chat_role', r);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg py-1 px-2.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="Admin">Admin (Full Access & Delete)</option>
              <option value="Manager">Manager (Backup & Restore)</option>
              <option value="Staff">Staff (View Logs Only)</option>
            </select>
          </div>
          <div className="text-slate-400 font-mono flex items-center gap-2">
            <span>Operator:</span>
            <input
              type="text"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="bg-transparent border-b border-slate-700/50 focus:border-indigo-500 pb-0.5 text-slate-200 focus:outline-none w-44"
              title="Simulator user identity"
            />
          </div>
        </div>

        {/* Scrollable workspace */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Top Quick Actions & Drag Drop Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Box: Trigger Backup Generation */}
            <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  Generate Cloud Backup
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Safely package all current product catalog items, price profiles, and historical stock records.
                  The package will be encrypted with **AES-256-CBC** before being archived on the secure container backend.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateBackup}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold text-xs rounded-lg transition-all focus:outline-none cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  Create Secure Backup On-Demand
                </button>
              </div>
            </div>

            {/* Right Box: Drag-and-Drop file Uploader */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/5'
                  : 'border-slate-800 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-950/40'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleUploadFile(e.target.files[0])}
                className="hidden"
                accept=".json,.zip,.enc"
              />
              <div className="w-9 h-9 rounded-lg bg-slate-850 flex items-center justify-center text-slate-400 mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-xs text-slate-200">
                Drag &amp; drop backup file here
              </h4>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal max-w-[200px]">
                or click to browse your device (supports **ZIP**, **JSON**, or encrypted format)
              </p>

              {uploadProgress !== null && (
                <div className="w-full mt-4">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Backup History Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Secure Archive Store
              </h3>

              {/* Search Bar */}
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search backups by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* List container */}
            <div className="border border-slate-800 bg-slate-950/20 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                      <th className="p-4">Backup Filename</th>
                      <th className="p-4">Pack Size</th>
                      <th className="p-4">Created Date</th>
                      <th className="p-4">Created By / Creator Info</th>
                      <th className="p-4 text-center">Cloud Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredBackups.length > 0 ? (
                      filteredBackups.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-850/30 transition-colors">
                          <td className="p-4 font-semibold text-slate-200">
                            <div className="flex items-center gap-2">
                              <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="truncate max-w-[180px]" title={b.originalName}>
                                {b.originalName}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-300 font-mono">
                            {(b.size / 1024).toFixed(2)} KB
                          </td>
                          <td className="p-4 text-slate-400">
                            {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] bg-slate-850 px-2 py-0.5 rounded text-indigo-300">
                                {b.createdBy}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Restore Trigger */}
                              <button
                                type="button"
                                onClick={() => handleRestoreBackup(b.id, b.originalName)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg transition-all border border-emerald-500/20 text-[10px] font-semibold cursor-pointer"
                                title="Restore database from this backup"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restore</span>
                              </button>

                              {/* Secure Share Trigger */}
                              <button
                                type="button"
                                onClick={() => handleShareBackup(b.id, b.originalName)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-lg transition-all border border-indigo-500/20 text-[10px] font-semibold cursor-pointer"
                                title="Share secure download links"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Share Link</span>
                              </button>

                              {/* Admin delete Trigger */}
                              <button
                                type="button"
                                onClick={() => handleDeleteBackup(b.id)}
                                disabled={userRole !== 'Admin'}
                                className={`p-1.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                                  userRole === 'Admin'
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                }`}
                                title={userRole === 'Admin' ? 'Delete this backup from server' : 'Admin rights required to delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                          No backup records found in database. Click "Create Secure Backup" above to generate one!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Footer info banner */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>All backup transfers are authenticated via custom HTTP Header payloads.</span>
          <span>LedgerHub Secure v2.4.0</span>
        </div>

        {/* SECURE SHARE OVERLAY MODAL */}
        <AnimatePresence>
          {activeShare && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-slate-200 text-sm">Secure Sharing Console</h3>
                  </div>
                  <button
                    onClick={() => setActiveShare(null)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg p-1 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>File:</span>
                    <span className="font-bold text-slate-200">{activeShare.filename}</span>
                  </div>
                  <div className="flex items-center justify-between text-amber-400 font-semibold text-[10px]">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Link Expiry:
                    </span>
                    <span>15 minutes (Expires: {new Date(activeShare.expiresAt).toLocaleTimeString()})</span>
                  </div>
                </div>

                {/* Display generate link with copying */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Decryption Share URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={activeShare.link}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg text-[11px] px-3 py-2 text-indigo-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                      title="Copy link to clipboard"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Sharing Platforms Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Here is the secure backup download link for LedgerHub (valid for 15 minutes): ${activeShare.link}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-2.5 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white font-semibold text-xs rounded-xl transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(activeShare.link)}&text=${encodeURIComponent('LedgerHub Secure Backup Download')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-2.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-400 hover:text-white font-semibold text-xs rounded-xl transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Telegram</span>
                  </a>

                  <a
                    href={`mailto:?subject=${encodeURIComponent('LedgerHub Backup File')}&body=${encodeURIComponent(`Here is the secure download link for the LedgerHub grocery shop database backup:\n\nLink: ${activeShare.link}\n\nNote: For safety, this download link will automatically expire in 15 minutes.`)}`}
                    className="flex items-center justify-center gap-2 p-2.5 bg-amber-600/10 hover:bg-amber-600 border border-amber-500/20 text-amber-400 hover:text-white font-semibold text-xs rounded-xl transition-all"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email Link</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-2 p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* RESTORE PROGRESS OVERLAY */}
        <AnimatePresence>
          {restoreProgress.isActive && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
              <div className="w-full max-w-md space-y-6 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mx-auto" />
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-100">Restoring Database State</h3>
                  <p className="text-xs text-slate-400 font-mono">Please do not close this window or reload the browser</p>
                </div>

                {/* Steps logs visualizer */}
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-left space-y-2.5 max-h-[180px] overflow-y-auto">
                  {restoreProgress.steps.map((step, idx) => {
                    const isDone = idx < restoreProgress.currentStepIdx;
                    const isCurrent = idx === restoreProgress.currentStepIdx;
                    return (
                      <div
                        key={idx}
                        className={`text-xs flex items-center gap-2 transition-all duration-300 ${
                          isDone
                            ? 'text-emerald-400 font-medium'
                            : isCurrent
                            ? 'text-indigo-400 font-semibold animate-pulse'
                            : 'text-slate-600'
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isCurrent ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <div className="w-1.5 h-1.5 bg-slate-700 rounded-full ml-1" />
                        )}
                        <span>{step}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Global percentage bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${(restoreProgress.currentStepIdx / restoreProgress.steps.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">
                    Restore Progress {Math.round((restoreProgress.currentStepIdx / restoreProgress.steps.length) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
