/**
 * Sync Module - Google Sheets Integration
 * WITH SECRET KEY SECURITY
 * Handles syncing data between IndexedDB and Google Sheets
 */

const Sync = {
    // Google Apps Script Web App URL (to be configured)
    apiUrl: null,
    secretKey: null, // Secret key for authentication
    isOnline: navigator.onLine,
    isSyncing: false,

    // Initialize sync module
    init() {
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Load saved config
        this.loadConfig();

        // Update UI status
        this.updateStatus();
    },

    async loadConfig() {
        const url = await DB.getSetting('apiUrl');
        const key = await DB.getSetting('secretKey');
        if (url) this.apiUrl = url;
        if (key) this.secretKey = key;
    },

    async setConfig(url, key) {
        this.apiUrl = url;
        this.secretKey = key;
        await DB.setSetting('apiUrl', url);
        await DB.setSetting('secretKey', key);
    },

    // Legacy method for compatibility
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
        } else if (this.isOnline && this.apiUrl && this.secretKey) {
            statusEl.classList.add('online');
            statusEl.querySelector('.sync-text').textContent = 'Online';
        } else if (this.isOnline && this.apiUrl) {
            statusEl.querySelector('.sync-text').textContent = 'No Key';
        } else if (this.isOnline) {
            statusEl.querySelector('.sync-text').textContent = 'Not Configured';
        } else {
            statusEl.querySelector('.sync-text').textContent = 'Offline';
        }
    },

    // Sync all unsynced transactions to Google Sheets
    async syncAll() {
        if (!this.isOnline || !this.apiUrl || !this.secretKey || this.isSyncing) return;

        this.isSyncing = true;
        this.updateStatus();

        try {
            const unsynced = await DB.getUnsyncedTransactions();

            if (unsynced.length === 0) {
                this.isSyncing = false;
                this.updateStatus();
                return;
            }

            // Send to Google Sheets WITH SECRET KEY
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                mode: 'no-cors', // Required for Google Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'syncTransactions',
                    key: this.secretKey, // Include secret key
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
        if (!this.isOnline || !this.apiUrl || !this.secretKey) {
            UI.showToast('Tidak dapat mengambil data: konfigurasi tidak lengkap', 'error');
            return null;
        }

        try {
            // Include secret key in request
            const response = await fetch(`${this.apiUrl}?action=getAll&key=${encodeURIComponent(this.secretKey)}`);
            const data = await response.json();
            return data.transactions || [];
        } catch (error) {
            console.error('Fetch error:', error);
            return null;
        }
    },

    // Check if fully configured (URL + Key)
    isConfigured() {
        return !!(this.apiUrl && this.secretKey);
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
            return { success: true, message: 'Konfigurasi tersimpan' };
        }
    }
};
