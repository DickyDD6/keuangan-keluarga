/**
 * App Module - Main Application Logic
 * Initializes app and handles global events
 */

const App = {
    // Initialize application
    async init() {
        try {
            // Initialize IndexedDB
            await DB.init();

            // Initialize default categories
            await DB.initDefaultCategories();

            // Initialize sync module
            Sync.init();

            // Setup event listeners
            this.setupEventListeners();

            // Render initial page
            await UI.renderPage('dashboard');

            // Register service worker
            this.registerServiceWorker();

            // Check for PWA install prompt
            this.setupPWAInstall();

            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ App initialization error:', error);
            UI.showToast('Error initializing app: ' + error.message, 'error');
        }
    },

    // Setup event listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                UI.renderPage(item.dataset.page);
            });
        });

        // Modal close
        document.getElementById('modalClose').addEventListener('click', () => {
            UI.hideModal();
        });

        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                UI.hideModal();
            }
        });

        // Transaction item click (for details/edit)
        document.getElementById('mainContent').addEventListener('click', (e) => {
            const txItem = e.target.closest('.transaction-item');
            if (txItem) {
                this.showTransactionDetail(txItem.dataset.id);
            }
        });
    },

    // Register service worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration.scope);
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    },

    // PWA Install prompt
    deferredPrompt: null,

    setupPWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallBanner();
        });
    },

    showInstallBanner() {
        // Check if already shown/dismissed
        if (localStorage.getItem('installBannerDismissed')) return;

        const banner = document.createElement('div');
        banner.className = 'install-banner';
        banner.innerHTML = `
            <div class="install-banner-text">
                📲 Install aplikasi untuk pengalaman lebih baik!
            </div>
            <button class="install-banner-btn" id="installBtn">Install</button>
            <button class="install-banner-close" id="dismissInstall">✕</button>
        `;
        document.body.appendChild(banner);

        document.getElementById('installBtn').addEventListener('click', async () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log('Install prompt outcome:', outcome);
                this.deferredPrompt = null;
            }
            banner.remove();
        });

        document.getElementById('dismissInstall').addEventListener('click', () => {
            localStorage.setItem('installBannerDismissed', 'true');
            banner.remove();
        });
    },

    // Show transaction detail
    async showTransactionDetail(id) {
        const transaction = await DB.getTransaction(id);
        if (!transaction) return;

        const categories = await DB.getAllCategories();
        const cat = categories.find(c => c.id === transaction.kategori) || { icon: '📦', nama: transaction.kategori };

        UI.showModal('Detail Transaksi', `
            <div style="text-align: center; margin-bottom: var(--spacing-lg);">
                <div style="font-size: 3rem; margin-bottom: var(--spacing-sm);">${cat.icon}</div>
                <div style="font-size: 1.5rem; font-weight: 700;" class="text-${transaction.tipe}">
                    ${transaction.tipe === 'masuk' ? '+' : '-'}${UI.formatCurrency(transaction.jumlah)}
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-muted);">Kategori</span>
                    <span>${cat.nama}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-muted);">Tanggal</span>
                    <span>${UI.formatDate(transaction.tanggal)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-muted);">Input Oleh</span>
                    <span>${transaction.inputOleh}</span>
                </div>
                ${transaction.keterangan ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Keterangan</span>
                        <span>${transaction.keterangan}</span>
                    </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-muted);">Status Sync</span>
                    <span>${transaction.synced ? '✅ Tersinkron' : '⏳ Belum sync'}</span>
                </div>
            </div>

            <div style="margin-top: var(--spacing-xl); display: flex; gap: var(--spacing-md);">
                <button class="btn btn-danger" style="flex: 1;" onclick="App.deleteTransaction('${id}')">
                    🗑️ Hapus
                </button>
            </div>
        `);
    },

    // Delete transaction
    async deleteTransaction(id) {
        if (confirm('Yakin ingin menghapus transaksi ini?')) {
            try {
                await DB.deleteTransaction(id);
                UI.hideModal();
                UI.showToast('Transaksi berhasil dihapus', 'success');
                UI.renderPage(UI.currentPage);
            } catch (error) {
                UI.showToast('Gagal menghapus: ' + error.message, 'error');
            }
        }
    },

    // Show sync setup modal
    showSyncSetup() {
        UI.showModal('⚙️ Konfigurasi Google Sheets', `
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: var(--spacing-lg);">
                Untuk menyinkronkan data ke Google Sheets, Anda perlu:
            </p>
            
            <ol style="color: var(--text-secondary); font-size: 0.85rem; padding-left: var(--spacing-lg); margin-bottom: var(--spacing-lg); line-height: 1.8;">
                <li>Buat Google Sheets baru</li>
                <li>Buka menu Extensions → Apps Script</li>
                <li>Copy-paste kode dari file <code>google-apps-script/Code.gs</code></li>
                <li>Deploy sebagai Web App (Execute as: Me, Who has access: Anyone)</li>
                <li>Copy URL web app dan paste di bawah</li>
            </ol>

            <div class="form-group">
                <label class="form-label">URL Google Apps Script</label>
                <input type="url" class="form-input" id="apiUrlInput" 
                    placeholder="https://script.google.com/macros/s/..." 
                    value="${Sync.apiUrl || ''}">
            </div>

            <button class="btn btn-primary" onclick="App.saveSyncConfig()">
                💾 Simpan Konfigurasi
            </button>
        `);
    },

    // Save sync configuration
    async saveSyncConfig() {
        const url = document.getElementById('apiUrlInput').value.trim();

        if (!url) {
            UI.showToast('Masukkan URL terlebih dahulu', 'error');
            return;
        }

        if (!url.startsWith('https://script.google.com/')) {
            UI.showToast('URL harus dari Google Apps Script', 'error');
            return;
        }

        await Sync.setApiUrl(url);
        UI.hideModal();
        UI.showToast('Konfigurasi berhasil disimpan! ✅', 'success');
        Sync.updateStatus();

        // Try to sync
        Sync.syncAll();

        // Refresh current page
        UI.renderPage(UI.currentPage);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
