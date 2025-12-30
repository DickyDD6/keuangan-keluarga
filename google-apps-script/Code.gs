/**
 * Google Apps Script - Backend for Keuangan Keluarga
 * WITH SECRET KEY SECURITY
 * 
 * Copy this code to Google Apps Script and deploy as Web App
 * 
 * IMPORTANT: Ganti SECRET_KEY di bawah dengan key rahasia Anda sendiri!
 */

// ============================================
// 🔐 SECRET KEY - GANTI DENGAN KEY ANDA SENDIRI!
// ============================================
const SECRET_KEY = "ddd06"; // Secret key untuk keamanan
// ============================================

// Spreadsheet configuration
const SHEET_NAME = 'Transaksi';

// Validate secret key
function validateKey(key) {
  return key === SECRET_KEY;
}

// Get or create sheet
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add headers
    sheet.getRange(1, 1, 1, 9).setValues([[
      'ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Keterangan', 'Input Oleh', 'Created At', 'Synced At'
    ]]);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// Handle GET requests
function doGet(e) {
  const action = e.parameter.action || 'getAll';
  const key = e.parameter.key || '';
  
  try {
    // Test action doesn't need key
    if (action === 'test') {
      return jsonResponse({ success: true, message: 'Connection successful!', secured: true });
    }
    
    // All other actions need valid key
    if (!validateKey(key)) {
      return jsonResponse({ success: false, error: 'Invalid secret key' });
    }
    
    switch (action) {
      case 'getAll':
        return jsonResponse({ success: true, transactions: getAllTransactions() });
      
      default:
        return jsonResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

// Handle POST requests
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'syncTransactions';
    const key = data.key || '';
    
    // Validate secret key for all POST requests
    if (!validateKey(key)) {
      return jsonResponse({ success: false, error: 'Invalid secret key' });
    }
    
    switch (action) {
      case 'syncTransactions':
        return jsonResponse(syncTransactions(data.transactions));
      
      case 'add':
        return jsonResponse(addTransaction(data.transaction));
      
      case 'delete':
        return jsonResponse(deleteTransaction(data.id));
      
      default:
        return jsonResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

// Get all transactions from sheet
function getAllTransactions() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return [];
  
  const transactions = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    transactions.push({
      id: row[0],
      tanggal: row[1],
      tipe: row[2],
      kategori: row[3],
      jumlah: row[4],
      keterangan: row[5],
      inputOleh: row[6],
      createdAt: row[7],
      syncedAt: row[8]
    });
  }
  
  return transactions;
}

// Sync multiple transactions
function syncTransactions(transactions) {
  if (!transactions || !Array.isArray(transactions)) {
    return { success: false, error: 'Invalid transactions data' };
  }
  
  const sheet = getSheet();
  const existingIds = getExistingIds(sheet);
  const syncedAt = new Date().toISOString();
  let syncedCount = 0;
  
  transactions.forEach(tx => {
    if (existingIds.includes(tx.id)) {
      // Update existing
      updateTransactionRow(sheet, tx, syncedAt);
    } else {
      // Add new
      sheet.appendRow([
        tx.id,
        tx.tanggal,
        tx.tipe,
        tx.kategori,
        tx.jumlah,
        tx.keterangan || '',
        tx.inputOleh,
        tx.createdAt,
        syncedAt
      ]);
    }
    syncedCount++;
  });
  
  return { success: true, syncedCount: syncedCount };
}

// Get existing transaction IDs
function getExistingIds(sheet) {
  const data = sheet.getDataRange().getValues();
  const ids = [];
  
  for (let i = 1; i < data.length; i++) {
    ids.push(data[i][0]);
  }
  
  return ids;
}

// Update existing transaction row
function updateTransactionRow(sheet, tx, syncedAt) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === tx.id) {
      sheet.getRange(i + 1, 1, 1, 9).setValues([[
        tx.id,
        tx.tanggal,
        tx.tipe,
        tx.kategori,
        tx.jumlah,
        tx.keterangan || '',
        tx.inputOleh,
        tx.createdAt,
        syncedAt
      ]]);
      return;
    }
  }
}

// Add single transaction
function addTransaction(tx) {
  const sheet = getSheet();
  const syncedAt = new Date().toISOString();
  
  sheet.appendRow([
    tx.id,
    tx.tanggal,
    tx.tipe,
    tx.kategori,
    tx.jumlah,
    tx.keterangan || '',
    tx.inputOleh,
    tx.createdAt,
    syncedAt
  ]);
  
  return { success: true, id: tx.id };
}

// Delete transaction
function deleteTransaction(id) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { success: false, error: 'Transaction not found' };
}

// Create JSON response
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
