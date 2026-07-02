import { DailyLog } from '../types';

/**
 * Generates an Excel-compatible HTML Spreadsheet from a DailyLog.
 * 
 * Sizing & Layout Improvements:
 * - Proper column width autofits (explicit `<colgroup>` in columns).
 * - All table headers centered, bold, with custom deep-blue background.
 * - Text columns aligned left, numeric columns aligned right, serials/dates centered.
 * - Bold highlighted totals and net profit summaries.
 * - Crisp borders and cell padding for readability.
 * - Freezes header rows (Top 4 rows).
 * - Page margins configured for A4 Landscape printing.
 */
export function generateExcelHTML(log: DailyLog): string {
  const stockItems = log.stockItems || [];
  const cashDetails = log.cashDetails || { morningOpening: 0, nightClosing: 0, gpaySales: 0, handSales: 0 };
  const expenses = log.expenses || [];

  const totalStockSalesCount = stockItems.reduce((acc, item) => acc + item.salesCount, 0);
  const totalStockRevenue = stockItems.reduce((acc, item) => acc + (item.salesCount * item.itemPrice), 0);
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const totalRecordedSales = cashDetails.handSales + cashDetails.gpaySales;

  // Header styles and page-break definitions
  let html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Daily Ledger</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
            <x:FreezePanes/>
            <x:FrozenNoSplit/>
            <x:SplitHorizontal>4</x:SplitHorizontal>
            <x:TopRowBottomPane>4</x:TopRowBottomPane>
            <x:ActivePane>2</x:ActivePane>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    @page {
      margin: 0.5in 0.5in 0.5in 0.5in;
      mso-header-margin: 0.25in;
      mso-footer-margin: 0.25in;
      mso-page-orientation: landscape;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      margin: 20px;
      color: #1e293b;
    }
    h1 {
      color: #1e3a8a;
      font-size: 16pt;
      margin-top: 10px;
      margin-bottom: 4px;
      font-weight: bold;
      text-align: left;
    }
    .subtitle {
      color: #475569;
      font-size: 10.5pt;
      margin-top: 0;
      margin-bottom: 20px;
      font-weight: 500;
      text-align: left;
    }
    h3 {
      color: #0f172a;
      font-size: 11.5pt;
      margin-top: 22px;
      margin-bottom: 8px;
      font-weight: bold;
      border-bottom: 1.5pt solid #3b82f6;
      padding-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    table {
      border-collapse: collapse;
      margin-bottom: 15px;
      width: 100%;
      background-color: #ffffff;
    }
    
    /* Rows height matches request */
    tr {
      height: 22pt;
    }
    
    th {
      background-color: #1e3a8a;
      color: #ffffff;
      font-weight: bold;
      border: 1px solid #475569;
      text-align: center;
      vertical-align: middle;
      font-size: 10pt;
      padding: 5px 10px;
      white-space: nowrap;
    }
    
    td {
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      font-size: 9.5pt;
      padding: 5px 10px;
      white-space: normal;
      word-wrap: break-word;
    }
    
    /* Precise Cell Alignments */
    .align-left {
      text-align: left !important;
    }
    .align-center {
      text-align: center !important;
    }
    .align-right {
      text-align: right !important;
    }
    
    /* Highlight Classes */
    .footer-row {
      background-color: #f1f5f9 !important;
      font-weight: bold !important;
      border-top: 1.5pt solid #475569 !important;
      border-bottom: 1.5pt double #475569 !important;
    }
    
    .label-cell {
      background-color: #f8fafc;
      font-weight: 600;
      text-align: left !important;
    }
    
    .bg-profit-gain {
      background-color: #f0fdf4 !important;
      color: #166534 !important;
      font-weight: bold !important;
    }
    
    .bg-profit-loss {
      background-color: #fef2f2 !important;
      color: #991b1b !important;
      font-weight: bold !important;
    }

    .bg-highlight-blue {
      background-color: #eff6ff !important;
      font-weight: bold !important;
    }

    .bg-highlight-slate {
      background-color: #f8fafc !important;
      font-weight: bold !important;
    }
    
    /* Empty spacer class */
    .spacer-tr {
      height: 12pt;
      border: none;
    }
    .spacer-td {
      border: none;
      background-color: transparent;
    }
  </style>
</head>
<body>
  <h1>Daily Stock & Cash Ledger Report</h1>
  <div class="subtitle">Date: ${log.date} &nbsp;|&nbsp; Status: ${log.isCompleted ? 'Closed & Sealed' : 'Draft / Active Worksheet'} &nbsp;|&nbsp; Exported: ${new Date().toLocaleDateString()}</div>

  <h3>1. Stock Details</h3>
  <table>
    <colgroup>
      <col width="60" />
      <col width="220" />
      <col width="120" />
      <col width="110" />
      <col width="120" />
      <col width="115" />
      <col width="120" />
      <col width="140" />
    </colgroup>
    <thead>
      <tr>
        <th>S.No</th>
        <th>Item Name</th>
        <th>Opening Stock</th>
        <th>Refill Stock</th>
        <th>Balance Stock</th>
        <th>Sales Count</th>
        <th>Price (₹)</th>
        <th>Revenue (₹)</th>
      </tr>
    </thead>
    <tbody>
  `;

  stockItems.forEach((item, index) => {
    html += `
      <tr>
        <td class="align-center">${index + 1}</td>
        <td class="align-left">${item.itemName}</td>
        <td class="align-right">${item.openStock}</td>
        <td class="align-right">${item.refillStock}</td>
        <td class="align-right">${item.balanceStock}</td>
        <td class="align-right">${item.salesCount}</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00';">₹${item.itemPrice.toFixed(2)}</td>
        <td class="align-right font-bold" style="mso-number-format:'\\₹#,##0.00';">₹${(item.salesCount * item.itemPrice).toFixed(2)}</td>
      </tr>
    `;
  });

  html += `
      <tr class="footer-row">
        <td colspan="2" class="align-center font-bold">Total Stock Metrics</td>
        <td class="align-right">${stockItems.reduce((acc, item) => acc + item.openStock, 0)}</td>
        <td class="align-right">${stockItems.reduce((acc, item) => acc + item.refillStock, 0)}</td>
        <td class="align-right">${stockItems.reduce((acc, item) => acc + item.balanceStock, 0)}</td>
        <td class="align-right">${totalStockSalesCount}</td>
        <td class="align-center">-</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00'; font-weight: bold; color: #1e3a8a;">₹${totalStockRevenue.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <h3>2. Cash Details</h3>
  <table>
    <colgroup>
      <col width="300" />
      <col width="200" />
    </colgroup>
    <thead>
      <tr>
        <th>Parameter</th>
        <th>Value (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bg-label">Morning Opening Cash</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00';">₹${cashDetails.morningOpening.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="bg-label">Hand Cash Sales</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00';">₹${cashDetails.handSales.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="bg-label">GPay UPI Sales</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00';">₹${cashDetails.gpaySales.toFixed(2)}</td>
      </tr>
      <tr class="bg-highlight-blue">
        <td class="bg-label font-bold" style="color: #1e3a8a;">Total Recorded Sales</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00'; font-weight: bold; color: #1e3a8a;">₹${totalRecordedSales.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <h3>3. Expense List</h3>
  <table>
    <colgroup>
      <col width="60" />
      <col width="250" />
      <col width="180" />
      <col width="150" />
    </colgroup>
    <thead>
      <tr>
        <th>S.No</th>
        <th>Category</th>
        <th>Payment Method</th>
        <th>Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
  `;

  if (expenses.length === 0) {
    html += `
      <tr>
        <td colspan="4" class="align-center" style="color: #64748b; font-style: italic;">No expenses recorded today</td>
      </tr>
    `;
  } else {
    expenses.forEach((exp, index) => {
      html += `
        <tr>
          <td class="align-center">${index + 1}</td>
          <td class="align-left">${exp.category}</td>
          <td class="align-center" style="text-transform: uppercase;">${exp.paymentMethod}</td>
          <td class="align-right" style="mso-number-format:'\\₹#,##0.00';">₹${exp.amount.toFixed(2)}</td>
        </tr>
      `;
    });
  }

  html += `
      <tr class="footer-row">
        <td colspan="3" class="align-center font-bold">Total Expenses</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00'; font-weight: bold; color: #b91c1c;">₹${totalExpenses.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <h3>4. Performance Summary</h3>
  <table>
    <colgroup>
      <col width="250" />
      <col width="300" />
      <col width="150" />
    </colgroup>
    <thead>
      <tr>
        <th>Metric</th>
        <th>Formula</th>
        <th>Value (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bg-label">Total Revenue (Sales)</td>
        <td class="align-left">Hand Cash Sales + GPay UPI Sales</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00'; font-weight: bold; color: #1e3a8a;">₹${totalRecordedSales.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="bg-label">Total Expenses</td>
        <td class="align-left">Sum of all operational payouts</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00'; font-weight: bold; color: #b91c1c;">₹${totalExpenses.toFixed(2)}</td>
      </tr>
      <tr class="${totalRecordedSales - totalExpenses >= 0 ? 'bg-profit-gain' : 'bg-profit-loss'}">
        <td class="bg-label font-bold" style="background-color: transparent;">Net Daily Profit</td>
        <td class="align-left">Total Revenue - Total Expenses</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00'; font-weight: bold;">₹${(totalRecordedSales - totalExpenses).toFixed(2)}</td>
      </tr>
      <tr>
        <td class="bg-label">Computed Retail Inventory Sold</td>
        <td class="align-left">Sum of (Sales Count × Item Retail Price)</td>
        <td class="align-right" style="mso-number-format:'\\₹#,##0.00'; font-weight: bold; color: #475569;">₹${totalStockRevenue.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <h3>5. Remarks & Special Notes</h3>
  <div style="margin: 10px 0; border: 1px solid #cbd5e1; padding: 12px; background-color: #f8fafc; font-size: 10pt; text-align: left; border-radius: 8px; line-height: 1.5; white-space: normal;">
    ${log.notes ? log.notes.replace(/\n/g, '<br>') : '<em>No remarks or special notes entered for today.</em>'}
  </div>

  <div style="margin-top: 30px; text-align: center; font-size: 8.5pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px;">
    Report generated on ${new Date().toLocaleString()} | Powered by LedgerHub Client Interface
  </div>
</body>
</html>`;

  return html;
}
