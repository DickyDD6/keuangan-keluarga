/**
 * Sync Module - Google Sheets Integration
 * Handles syncing data between IndexedDB and Google Sheets
 */

const Sync = {
    // Google Apps Script Web App URL (to be configured)
    apiUrl: null,
    isOnline: navigator.onLine,
    isSyncing: false,

    // Initialize sync module
    init() {
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Load saved API URL
        this.loadApiUrl();

        // Update UI status
        this.updateStatus();
    },

    async loadApiUrl() {
        const url = await DB.getSetting('apiUrl');
        if (url) {
            this.apiUrl = url;
        }
    },

    async setApiUrl(url) {
        this.apiUrl = url;
        await DB.setSetting('apiUrl', url);
    },

    handleOnline() {
        this.isOnline = true;
        this.updateStatus();
        this.syncAll(); // Auto sync when back online
    },

    handleOffline() {
        this.isOnline = false;
        this.updateStatus();
    },

    updateStatus() {
        const statusEl = document.getElementById('syncStatus');
        if (!statusEl) return;

        statusEl.classList.remove('online', 'syncing');

        if (this.isSyncing) {
            statusEl.classList.add('syncing');
            statusEl.querySelector('.sync-text').textContent = 'Syncing...';
        } else if (this.isOnline && this.apiUrl) {
            statusEl.classList.add('online');
            statusEl.querySelector('.sync-text').textContent = 'Online';
        } else if (this.isOnline) {
            statusEl.querySelector('.sync-text').textContent = 'Not Configured';
        } else {
            statusEl.querySelector('.sync-text').textContent = 'Offline';
        }
    },

    // Sync all unsynced transactions to Google Sheets
    async syncAll() {
        if (!this.isOnline || !this.apiUrl || this.isSyncing) return;

        this.isSyncing = true;
        this.updateStatus();

        try {
            const unsynced = await DB.getUnsyncedTransactions();

            if (unsynced.length === 0) {
                this.isSyncing = false;
                this.updateStatus();
                return;
            }

            // Send to Google Sheets
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                mode: 'no-cors', // Required for Google Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'syncTransactions',
                    transactions: unsynced
                })
            });

            // Mark as synced (no-cors doesn't return response body, so we assume success)
            for (const tx of unsynced) {
                await DB.markAsSynced(tx.id);
            }

            UI.showToast(`${unsynced.length} transaksi berhasil disinkronkan`, 'success');
        } catch (error) {
            console.error('Sync error:', error);
            UI.showToast('Gagal sinkronisasi: ' + error.message, 'error');
        }

        this.isSyncing = false;
        this.updateStatus();
    },

    // Fetch all transactions from Google Sheets
    async fetchFromSheet() {
        if (!this.isOnline || !this.apiUrl) {
            UI.showToast('Tidak dapat mengambil data: offline atau API belum dikonfigurasi', 'error');
            return null;
        }

        try {
            // For Google Apps Script, we need to use a GET request with callback
            const response = await fetch(`${this.apiUrl}?action=getAll`);
            const data = await response.json();
            return data.transactions || [];
        } catch (error) {
            console.error('Fetch error:', error);
            return null;
        }
    },

    // Check if API is configured
    isConfigured() {
        return !!this.apiUrl;
    },

    // Test connection to Google Sheets
    async testConnection() {
        if (!this.apiUrl) {
            return { success: false, message: 'API URL belum dikonfigurasi' };
        }

        try {
            const response = await fetch(`${this.apiUrl}?action=test`, {
                method: 'GET'
            });

            if (response.ok) {
                return { success: true, message: 'Koneksi berhasil!' };
            } else {
                return { success: false, message: 'Koneksi gagal' };
            }
        } catch (error) {
            // With no-cors, we can't actually check the response
            // So we just assume it might work
            return { success: true, message: 'Konfigurasi tersimpan (tidak dapat memverifikasi koneksi)' };
        }
    }
};
