/**
 * App Module - Main Application Logic
 * Initializes app and handles global events
 */

const App = {
    // Initialize application
    async init() {
        try {
            // Initialize IndexedDB first
            await DB.init();

            // Initialize default categories
            await DB.initDefaultCategories();

            // Check if users exist
            const hasUsers = await Auth.hasUsers();

            if (!hasUsers) {
                // First-time setup: show admin setup
                this.showAdminSetup();
            } else {
                // Check if user is logged in
                const isLoggedIn = await Auth.init();

                if (isLoggedIn) {
                    // User logged in, show main app
                    this.showMainApp();
                } else {
                    // Not logged in, show login page
                    this.showLogin();
                }
            }

            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ App initialization error:', error);
            UI.showToast('Error initializing app: ' + error.message, 'error');
        }
    },

    // Show main app (after login)
    async showMainApp() {
        // Hide login container
        document.getElementById('loginContainer').style.display = 'none';

        // Show main content and nav
        document.getElementById('mainContent').style.display = 'block';
        document.querySelector('.bottom-nav').style.display = 'flex';

        // Initialize sync module
        await Sync.init();

        // Setup event listeners
        this.setupEventListeners();

        // Update user info in header
        this.updateUserInfo();

        // Render initial page
        await UI.renderPage('dashboard');

        // Register service worker
        this.registerServiceWorker();

        // Check for PWA install prompt
        this.setupPWAInstall();
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

        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            if (confirm('Yakin ingin logout?')) {
                Auth.logout();
            }
        });
    },

    // ===== LOGIN SYSTEM =====

    // Show login page
    showLogin() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        document.querySelector('.bottom-nav').style.display = 'none';

        document.getElementById('loginContainer').innerHTML = `
            <div class="login-card">
                <div class="login-header">
                    <h2 class="login-title">\ud83d\udcb0 Keuangan Keluarga</h2>
                    <p class="login-subtitle">Login untuk melanjutkan</p>
                </div>
                <form id="loginForm" class="login-form">
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <input 
                            type="text" 
                            id="loginUsername" 
                            class="form-input" 
                            placeholder="mama, dicky, atau nanda"
                            autocomplete="username"
                            required 
                            autofocus>
                    </div>
                    <div class="form-group" style="position: relative;">
                        <label class="form-label">Password</label>
                        <input 
                            type="password" 
                            id="loginPassword" 
                            class="form-input" 
                            placeholder="Masukkan password"
                            autocomplete="current-password"
                            style="padding-right: 50px;"
                            required>
                        <button 
                            type="button" 
                            class="password-toggle" 
                            onclick="App.togglePassword('loginPassword', this)"
                            style="position: absolute; right: 12px; top: 36px; background: none; border: none; cursor: pointer; font-size: 1.2rem;">
                            👁️
                        </button>
                    </div>
                    <button type="submit" class="btn btn-primary">
                        \ud83d\udd11 Login
                    </button>
                </form>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    },

    // Show admin setup (first-time)
    showAdminSetup() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        document.querySelector('.bottom-nav').style.display = 'none';

        document.getElementById('loginContainer').innerHTML = `
            <div class="login-card">
                <div class="login-header">
                    <h2 class="login-title">\ud83d\udd10 Setup Admin</h2>
                    <p class="login-subtitle">Pertama kali? Setup akun admin (Dicky)</p>
                </div>
                <form id="setupForm" class="login-form">
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <input 
                            type="text" 
                            value="dicky" 
                            class="form-input" 
                            readonly>
                    </div>
                    <div class="form-group" style="position: relative;">
                        <label class="form-label">Password (min 4 karakter)</label>
                        <input 
                            type="password" 
                            id="setupPassword" 
                            class="form-input" 
                            placeholder="Password untuk dicky"
                            style="padding-right: 50px;"
                            required 
                            autofocus
                            minlength="4">
                        <button 
                            type="button" 
                            class="password-toggle" 
                            onclick="App.togglePassword('setupPassword', this)"
                            style="position: absolute; right: 12px; top: 36px; background: none; border: none; cursor: pointer; font-size: 1.2rem;">
                            👁️
                        </button>
                    </div>
                    <div class="form-group" style="position: relative;">
                        <label class="form-label">Confirm Password</label>
                        <input 
                            type="password" 
                            id="setupConfirm" 
                            class="form-input" 
                            placeholder="Ketik ulang password"
                            style="padding-right: 50px;"
                            required
                            minlength="4">
                        <button 
                            type="button" 
                            class="password-toggle" 
                            onclick="App.togglePassword('setupConfirm', this)"
                            style="position: absolute; right: 12px; top: 36px; background: none; border: none; cursor: pointer; font-size: 1.2rem;">
                            👁️
                        </button>
                    </div>
                    <button type="submit" class="btn btn-primary">
                        \u2705 Setup Admin
                    </button>
                </form>
            </div>
        `;

        document.getElementById('setupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAdminSetup();
        });
    },

    // Handle login
    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            await Auth.login(username, password);
            UI.showToast(`Selamat datang, ${Auth.currentUser.displayName}! \ud83d\udc4b`, 'success');
            this.showMainApp();
        } catch (error) {
            UI.showToast(error.message, 'error');
        }
    },

    // Handle admin setup
    async handleAdminSetup() {
        const password = document.getElementById('setupPassword').value;
        const confirm = document.getElementById('setupConfirm').value;

        if (password !== confirm) {
            UI.showToast('Password tidak cocok!', 'error');
            return;
        }

        try {
            await Auth.setupAdmin('dicky', password);
            await Auth.login('dicky', password);
            UI.showToast('Admin berhasil dibuat! Selamat datang, Dicky! \ud83d\udc4b', 'success');
            this.showMainApp();
        } catch (error) {
            UI.showToast(error.message, 'error');
        }
    },

    // Update user info in header
    updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');

        if (Auth.currentUser) {
            userName.textContent = Auth.currentUser.displayName;
            if (Auth.currentUser.role === 'admin') {
                userName.innerHTML += ' <span class="admin-badge">Admin</span>';
            }
            userInfo.style.display = 'flex';
        }
    },

    // Toggle password visibility
    togglePassword(inputId, button) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            button.textContent = '🙈'; // closed eye
        } else {
            input.type = 'password';
            button.textContent = '👁️'; // open eye
        }
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
        UI.showModal('🔐 Konfigurasi Google Sheets', `
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: var(--spacing-lg);">
                Untuk menyinkronkan data ke Google Sheets dengan aman:
            </p>
            
            <ol style="color: var(--text-secondary); font-size: 0.85rem; padding-left: var(--spacing-lg); margin-bottom: var(--spacing-lg); line-height: 1.8;">
                <li>Buat Google Sheets baru</li>
                <li>Buka menu Extensions → Apps Script</li>
                <li>Copy-paste kode dari file <code>google-apps-script/Code.gs</code></li>
                <li><strong>PENTING:</strong> Ganti SECRET_KEY di Code.gs dengan key rahasia Anda</li>
                <li>Deploy sebagai Web App</li>
                <li>Isi URL dan Secret Key yang sama di bawah</li>
            </ol>

            <div class="form-group">
                <label class="form-label">URL Google Apps Script</label>
                <input type="url" class="form-input" id="apiUrlInput" 
                    placeholder="https://script.google.com/macros/s/..." 
                    value="${Sync.apiUrl || ''}">
            </div>

            <div class="form-group">
                <label class="form-label">🔑 Secret Key (harus sama dengan di Code.gs)</label>
                <input type="password" class="form-input" id="secretKeyInput" 
                    placeholder="Masukkan secret key..." 
                    value="${Sync.secretKey || ''}">
                <small style="color: var(--text-muted); font-size: 0.75rem;">
                    Key ini harus sama persis dengan yang ada di Google Apps Script
                </small>
            </div>

            <button class="btn btn-primary" onclick="App.saveSyncConfig()">
                💾 Simpan Konfigurasi
            </button>
        `);
    },

    // Save sync configuration
    async saveSyncConfig() {
        const url = document.getElementById('apiUrlInput').value.trim();
        const key = document.getElementById('secretKeyInput').value.trim();

        if (!url) {
            UI.showToast('Masukkan URL terlebih dahulu', 'error');
            return;
        }

        if (!url.startsWith('https://script.google.com/')) {
            UI.showToast('URL harus dari Google Apps Script', 'error');
            return;
        }

        if (!key) {
            UI.showToast('Masukkan Secret Key', 'error');
            return;
        }

        await Sync.setConfig(url, key);
        UI.hideModal();
        UI.showToast('Konfigurasi berhasil disimpan! 🔐', 'success');
        Sync.updateStatus();

        // Try to sync
        Sync.syncAll();

        // Refresh current page
        UI.renderPage(UI.currentPage);
    },

    // Manual sync trigger
    async manualSync() {
        if (!Sync.isConfigured()) {
            UI.showToast('Konfigurasi sync belum diatur', 'error');
            return;
        }

        UI.showToast('Memulai sinkronisasi...', 'info');

        try {
            await Sync.syncAll();
            UI.showToast('Sinkronisasi selesai! Cek Google Sheets Anda 🎉', 'success');
        } catch (error) {
            UI.showToast('Gagal sync: ' + error.message, 'error');
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
