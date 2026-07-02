/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with User-Agent header as required by the guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// AI Assistant Chat Route
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message, history, ledgerState, userRole } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Prepare catalog context
    const masterItems = ledgerState?.masterItems || [];
    const currentLog = ledgerState?.currentLog || null;
    const logDates = ledgerState?.logDates || [];
    const selectedDate = ledgerState?.selectedDate || '';

    // Create a rich context prompt about the current state of the ledger
    let ledgerContext = `
You are the advanced "LedgerHub AI" Multilingual Assistant for a Grocery Shop Stock & Cash Management system.
The shop tracks daily stocks, cash balances, and expenses.

CURRENT SHOP SYSTEM CONTEXT:
- Selected Date for View/Entry: ${selectedDate || 'Today'}
- User Access Role: ${userRole || 'Staff'} (Supported roles: Admin, Manager, Staff)
- Catalog Master Products (${masterItems.length} products configured):
${masterItems.map((it: any) => `  * [ID: ${it.id}] Name: "${it.name}" (Default Price: ₹${it.defaultPrice || 0}, Default Opening Stock: ${it.defaultOpenStock || 0})`).join('\n')}

CURRENT LOG DATE'S STOCK STATUS:
${
  currentLog && currentLog.stockItems && currentLog.stockItems.length > 0
    ? currentLog.stockItems
        .map(
          (s: any) =>
            `  * "${s.itemName}" [ID: ${s.itemId}] -> Open: ${s.openStock}, Refills: ${s.refillStock}, Remaining Balance: ${s.balanceStock}, Sales Count: ${s.salesCount}, Price: ₹${s.itemPrice}, Calculated Revenue: ₹${(s.salesCount * s.itemPrice).toFixed(2)}`
        )
        .join('\n')
    : '  * No stock records entered for this date yet.'
}

CURRENT DAILY CASH & EXPENSES:
- Cash Details:
  * Morning Opening Cash: ₹${currentLog?.cashDetails?.morningOpening || 0}
  * Night Closing Cash: ₹${currentLog?.cashDetails?.nightClosing || 0}
  * GPay Sales Total: ₹${currentLog?.cashDetails?.gpaySales || 0}
  * Hand Cash Sales Total: ₹${currentLog?.cashDetails?.handSales || 0}
  * Total Physical/Recorded Sales: ₹${
    (currentLog?.cashDetails?.gpaySales || 0) + (currentLog?.cashDetails?.handSales || 0)
  }
- Expenses (${currentLog?.expenses?.length || 0} expenses logged):
${
  currentLog?.expenses && currentLog.expenses.length > 0
    ? currentLog.expenses
        .map((e: any) => `  * Category: ${e.category} | Amount: ₹${e.amount} | Description: "${e.description}" | Paid via: ${e.paymentMethod}`)
        .join('\n')
    : '  * No expenses logged for this date.'
}
- Log Status: ${currentLog?.isCompleted ? 'Closed/Completed' : 'Draft/Open'}
- List of Dates with Log Entries: ${logDates.join(', ') || 'No older log history available.'}

INSTRUCTIONS FOR DETECTING INVENTORY METRICS & SIMULATING MISSING METADATA:
1. Product Locations: Product storage locations are structured in standard aisles:
   - Aisle 1 (Grains, Rice, Flour, Sugar)
   - Aisle 2 (Oils, Ghee, Vanaspati)
   - Aisle 3 (Spices, Condiments, Salt, Tea, Coffee)
   - Aisle 4 (Snacks, Chocolates, Biscuits)
   - Aisle 5 (Dairy, Beverages, Cold Drinks)
   Whenever the user asks about a product location, assign it to a realistic logical aisle.
2. Expiry Tracking:
   - Fresh items (e.g., Milk, Bread, Curd) have short shelf life. If in catalog, simulate they expire within 3 to 7 days.
   - Snacks, biscuits, beverages expire within 15 to 30 days.
   - Grains, sugar, tea, oil expire in 3 to 6 months.
   - Recommend discounting items near expiry (e.g. 20% to 50% discount) to clear stock, and advise discarding if expired.
3. Restocking & Purchases:
   - Identify low stock where Remaining Balance <= 5 or Balance is under 15% of default opening.
   - Recommend reorder quantity: defaultOpenStock - balanceStock, or a logical bulk size (e.g. 50 or 100 units).
   - Simulate supplier delivery tracking or pending purchase orders realistically in text, and give reassuring professional estimates (e.g. "Arriving in 2 days from Supplier ABC").

ROLE-BASED AUTHORIZATION RULES:
- Staff: Can query stock, search products, view daily metrics, and perform basic operations. If they try to change pricing, access profit reports, or reset data, politely guide them that Admin or Manager clearance is required.
- Manager: Full inventory control, can log expenses, update pricing, view sales summaries, and reorder.
- Admin: Full override access, can query everything, check profit reports, view net margins, and reset data.

ACTION CONTROLS (EXECUTION ENGINE):
If the user's message contains a direct, unambiguous command to update stock, log expense, update cash, or navigate, you MUST provide the structured action payload so the UI can execute it instantly. Supported action types:
1. UPDATE_STOCK: For commands like "Add 50 units of sugar", "Update bread balance to 5", etc.
   - payload: { itemId: string, field: "openStock" | "refillStock" | "balanceStock", value: number }
2. ADD_EXPENSE: For commands like "Add an expense of 200 for tea", "Log 500 EB Bill expense", etc.
   - payload: { category: string, amount: number, description: string, paymentMethod: "cash" | "gpay" }
3. UPDATE_CASH: For commands like "Set morning cash to 1000", "Update night closing cash to 12000"
   - payload: { field: "morningOpening" | "nightClosing" | "gpaySales" | "handSales", value: number }
4. NAVIGATE: For switching tabs like "Show me the analytics" or "Go to compliance overview"
   - payload: { tab: "ledger" | "analytics" }
5. OPEN_MANAGE_CATALOG: For "Open catalog manager", "Manage catalog items"
   - payload: {}

Reply to the user in their detected language. Support English, Tamil (தமிழ்), Hindi (हिंदी), Telugu (తెలుగు), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം), Marathi (मराठी), Bengali (বাংলা), Gujarati (ગુજરાતી), Punjabi (ਪੰਜਾਬੀ), Arabic, French, German, Spanish, Japanese, and Chinese. If they speak in a language or ask a question in a language, automatically translate and explain in that language.
`;

    // Construct simple flat history array for Gemini. Use `gemini-3.5-flash`.
    // Format history as contents parts for Gemini API
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        contents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.text || h.parts?.[0]?.text || '' }],
        });
      });
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Call generateContent with config
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction: ledgerContext,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'Conversational markdown reply, naturally answering the query in the detected language.',
            },
            action: {
              type: Type.OBJECT,
              description: 'Optional. Triggers immediate reactive client UI update when user gives commands.',
              properties: {
                type: {
                  type: Type.STRING,
                  description: 'The type of action to execute',
                },
                payload: {
                  type: Type.OBJECT,
                  description: 'The payload parameters matching the required action structure',
                },
              },
            },
          },
          required: ['reply'],
        },
      },
    });

    const resultText = response.text?.trim() || '{}';
    let resultJson;
    try {
      resultJson = JSON.parse(resultText);
    } catch (e) {
      // Fallback if parsing fails
      resultJson = {
        reply: response.text || 'Sorry, I had trouble parsing the response schema. How can I help you with your inventory today?',
      };
    }

    res.json(resultJson);
  } catch (error: any) {
    console.error('Error handling assistant chat:', error);
    res.status(500).json({
      reply: 'An error occurred while connecting to the AI Assistant. Please check your internet connection or Gemini API Key.',
      error: error.message,
    });
  }
});

// --- BACKUP MANAGEMENT MODULE ---
import fs from 'fs';
import crypto from 'crypto';

const BACKUPS_DIR = path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
const HISTORY_FILE = path.join(BACKUPS_DIR, 'backup_history.json');
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
}

const ALGORITHM = 'aes-256-cbc';
const getEncryptionKey = () => {
  const secret = process.env.BACKUP_ENCRYPTION_KEY || 'ledgerhub-default-secure-backup-key-2026';
  return crypto.createHash('sha256').update(secret).digest();
};

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift() || '', 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function calculateChecksum(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

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

function getHistory(): BackupLog[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading backup history:', e);
  }
  return [];
}

function saveHistory(history: BackupLog[]): void {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving backup history:', e);
  }
}

// Generate time-limited signed URL helper
const SIGNING_SECRET = process.env.BACKUP_SIGNING_SECRET || 'ledgerhub-signing-secret-key-182312';
function generateSignedToken(backupId: string, expiresAt: number): string {
  const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
  hmac.update(`${backupId}:${expiresAt}`);
  return hmac.digest('hex');
}

function verifySignedToken(backupId: string, expiresAt: number, signature: string): boolean {
  if (Date.now() > expiresAt) {
    return false; // Expired
  }
  const expected = generateSignedToken(backupId, expiresAt);
  return signature === expected;
}

// 1. Get Backups list
app.get('/api/backups', (req, res) => {
  const userRole = req.headers['x-user-role'] as string;
  if (!userRole) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const history = getHistory();
  res.json(history);
});

// 2. Generate on-demand backup
app.post('/api/backups/generate', (req, res) => {
  try {
    const { payload, userRole, userEmail } = req.body;
    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!payload) {
      return res.status(400).json({ error: 'Payload is required' });
    }

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const checksum = calculateChecksum(payloadStr);

    const history = getHistory();
    // Check for duplicate uploads/generations
    const duplicate = history.find((b) => b.checksum === checksum);
    if (duplicate) {
      return res.status(409).json({ 
        error: 'Duplicate backup payload detected. An identical backup already exists.',
        backup: duplicate 
      });
    }

    const backupId = 'backup-' + crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const formattedDate = new Date().toISOString().replace(/[-:T]/g, '_').split('.')[0];
    const filename = `ledgerhub_backup_${formattedDate}.enc`;

    // Encrypt and store securely
    const encryptedData = encrypt(payloadStr);
    fs.writeFileSync(path.join(BACKUPS_DIR, filename), encryptedData, 'utf8');

    const newBackup: BackupLog = {
      id: backupId,
      filename,
      originalName: `ledgerhub_backup_${formattedDate}.json`,
      size: Buffer.byteLength(payloadStr, 'utf8'),
      fileType: 'json',
      createdAt: timestamp,
      version: '1.0.0',
      checksum,
      createdBy: `${userRole} (${userEmail || 'Local'})`,
      logs: [`${timestamp}: Generated backup on-demand by ${userRole}`],
    };

    history.push(newBackup);
    saveHistory(history);

    res.status(201).json(newBackup);
  } catch (error: any) {
    console.error('Error generating backup:', error);
    res.status(500).json({ error: 'Failed to generate backup: ' + error.message });
  }
});

// 3. Upload raw/base64 backup
app.post('/api/backups/upload', (req, res) => {
  try {
    const { filename, content, fileType, userRole, userEmail } = req.body;
    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const backupId = 'backup-' + crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const safeFilename = `uploaded_${backupId}_${filename || 'backup.enc'}`;

    // Calculate checksum of raw data
    const checksum = calculateChecksum(content);

    const history = getHistory();
    const duplicate = history.find((b) => b.checksum === checksum);
    if (duplicate) {
      return res.status(409).json({ 
        error: 'Duplicate backup detected. This file has already been uploaded.',
        backup: duplicate 
      });
    }

    // Encrypt and store securely
    const encryptedData = encrypt(content);
    fs.writeFileSync(path.join(BACKUPS_DIR, safeFilename), encryptedData, 'utf8');

    const newBackup: BackupLog = {
      id: backupId,
      filename: safeFilename,
      originalName: filename || 'backup.json',
      size: Buffer.byteLength(content, 'utf8'),
      fileType: fileType || 'json',
      createdAt: timestamp,
      version: '1.0.0',
      checksum,
      createdBy: `${userRole} (${userEmail || 'Local'})`,
      logs: [`${timestamp}: Uploaded file by ${userRole}`],
    };

    history.push(newBackup);
    saveHistory(history);

    res.status(201).json(newBackup);
  } catch (error: any) {
    console.error('Error uploading backup:', error);
    res.status(500).json({ error: 'Failed to upload backup: ' + error.message });
  }
});

// 4. Generate signed share link
app.post('/api/backups/share/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.headers['x-user-role'] as string;
    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const history = getHistory();
    const backup = history.find((b) => b.id === id);
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity
    const signature = generateSignedToken(id, expiresAt);

    res.json({
      id,
      expiresAt,
      token: signature,
      expiresIn: '15 minutes'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Download backup
app.get('/api/backups/download/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { token, expires } = req.query;

    const history = getHistory();
    const backup = history.find((b) => b.id === id);
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // Verify authentication via headers OR signed URL parameters
    const userRole = req.headers['x-user-role'] as string;
    if (!userRole) {
      if (!token || !expires || !verifySignedToken(id, Number(expires), token as string)) {
        return res.status(403).json({ error: 'Unauthorized or Link Expired' });
      }
    }

    const filePath = path.join(BACKUPS_DIR, backup.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical backup file not found on disk' });
    }

    const encryptedData = fs.readFileSync(filePath, 'utf8');
    const decryptedData = decrypt(encryptedData);

    // Log the download action
    backup.logs.push(`${new Date().toISOString()}: Downloaded`);
    saveHistory(history);

    res.setHeader('Content-Disposition', `attachment; filename="${backup.originalName}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(decryptedData);
  } catch (error: any) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ error: 'Failed to download: ' + error.message });
  }
});

// 6. Restore backup endpoint (fetch data)
app.get('/api/backups/restore/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.headers['x-user-role'] as string;
    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const history = getHistory();
    const backup = history.find((b) => b.id === id);
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const filePath = path.join(BACKUPS_DIR, backup.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file missing' });
    }

    const encryptedData = fs.readFileSync(filePath, 'utf8');
    const decryptedData = decrypt(encryptedData);

    backup.logs.push(`${new Date().toISOString()}: Restored by ${userRole}`);
    saveHistory(history);

    res.json({
      success: true,
      data: JSON.parse(decryptedData),
      backup
    });
  } catch (error: any) {
    console.error('Error in restore endpoint:', error);
    res.status(500).json({ error: 'Restore preparation failed: ' + error.message });
  }
});

// 7. Delete backup (Admin only)
app.delete('/api/backups/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.headers['x-user-role'] as string;
    if (userRole !== 'Admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    let history = getHistory();
    const backupIdx = history.findIndex((b) => b.id === id);
    if (backupIdx === -1) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = history[backupIdx];
    const filePath = path.join(BACKUPS_DIR, backup.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    history.splice(backupIdx, 1);
    saveHistory(history);

    res.json({ success: true, message: 'Backup successfully deleted from backend storage' });
  } catch (error: any) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup: ' + error.message });
  }
});

// Serve Vite dev server or production static assets
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LedgerHub Server] Running at http://0.0.0.0:${PORT} in ${isProd ? 'production' : 'development'} mode`);
  });
}

startServer();
