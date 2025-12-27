/**
 * UI Module - Rendering and UI Components
 * Handles all page rendering and UI interactions
 */

const UI = {
    currentPage: 'dashboard',
    currentTransactionType: 'keluar',
    selectedCategory: null,

    // Family members for input dropdown
    familyMembers: ['Mama', 'Dicky', 'Nanda'],

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    // Format date
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);
    },

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // Show modal
    showModal(title, content) {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        modal.classList.add('show');
    },

    // Hide modal
    hideModal() {
        document.getElementById('modal').classList.remove('show');
    },

    // Get date range for period
    getDateRange(period) {
        const now = new Date();
        const start = new Date();
        const end = new Date();

        switch (period) {
            case 'hari':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'minggu':
                const dayOfWeek = now.getDay();
                start.setDate(now.getDate() - dayOfWeek);
                start.setHours(0, 0, 0, 0);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            case 'bulan':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(end.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'tahun':
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(11, 31);
                end.setHours(23, 59, 59, 999);
                break;
        }

        return { start, end };
    },

    // RENDER PAGES

    async renderPage(page) {
        this.currentPage = page;
        const main = document.getElementById('mainContent');

        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Show loading
        main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        // Render page content
        switch (page) {
            case 'dashboard':
                main.innerHTML = await this.renderDashboard();
                break;
            case 'input':
                main.innerHTML = await this.renderInputPage();
                this.initInputPage();
                break;
            case 'laporan':
                main.innerHTML = await this.renderLaporanPage();
                this.initLaporanPage();
                break;
            case 'kategori':
                main.innerHTML = await this.renderKategoriPage();
                break;
        }
    },

    // DASHBOARD
    async renderDashboard() {
        const { start, end } = this.getDateRange('bulan');
        const stats = await DB.getStats(start, end);
        const transactions = await DB.getAllTransactions();
        const recentTransactions = transactions.slice(0, 5);
        const categories = await DB.getAllCategories();

        // Create category map for icons
        const catMap = {};
        categories.forEach(c => catMap[c.id] = c);

        return `
            <div class="summary-grid">
                <div class="summary-card income">
                    <div class="summary-label">Pemasukan</div>
                    <div class="summary-amount">${this.formatCurrency(stats.totalMasuk)}</div>
                </div>
                <div class="summary-card expense">
                    <div class="summary-label">Pengeluaran</div>
                    <div class="summary-amount">${this.formatCurrency(stats.totalKeluar)}</div>
                </div>
                <div class="summary-card balance">
                    <div class="summary-label">Saldo Bulan Ini</div>
                    <div class="summary-amount">${this.formatCurrency(stats.saldo)}</div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">Transaksi Terakhir</div>
                ${recentTransactions.length > 0 ? `
                    <div class="transaction-list">
                        ${recentTransactions.map(tx => {
            const cat = catMap[tx.kategori] || { icon: '📦', nama: tx.kategori };
            return `
                                <div class="transaction-item" data-id="${tx.id}">
                                    <div class="transaction-icon">${cat.icon}</div>
                                    <div class="transaction-info">
                                        <div class="transaction-category">${cat.nama}</div>
                                        <div class="transaction-detail">
                                            <span>${this.formatDate(tx.tanggal)}</span>
                                            <span>• ${tx.inputOleh}</span>
                                        </div>
                                    </div>
                                    <div class="transaction-amount ${tx.tipe}">
                                        ${tx.tipe === 'masuk' ? '+' : '-'}${this.formatCurrency(tx.jumlah)}
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <div class="empty-state-text">Belum ada transaksi</div>
                    </div>
                `}
            </div>

            ${!Sync.isConfigured() ? `
                <div class="card" style="border-color: rgba(251, 191, 36, 0.3);">
                    <div class="card-title">⚠️ Setup Sinkronisasi</div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: var(--spacing-md);">
                        Aplikasi belum terhubung ke Google Sheets. Data hanya tersimpan secara lokal.
                    </p>
                    <button class="btn btn-secondary" onclick="App.showSyncSetup()">
                        Konfigurasi Sekarang
                    </button>
                </div>
            ` : ''}
        `;
    },

    // INPUT PAGE
    async renderInputPage() {
        const categories = await DB.getAllCategories();
        const expenseCategories = categories.filter(c => c.tipe === 'keluar');
        const incomeCategories = categories.filter(c => c.tipe === 'masuk');

        const today = new Date().toISOString().split('T')[0];

        return `
            <div class="type-toggle">
                <button class="type-btn expense active" data-type="keluar">
                    📤 Pengeluaran
                </button>
                <button class="type-btn income" data-type="masuk">
                    📥 Pemasukan
                </button>
            </div>

            <form id="transactionForm">
                <div class="form-group">
                    <label class="form-label">Tanggal</label>
                    <input type="date" class="form-input" id="inputTanggal" value="${today}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Kategori</label>
                    <div class="category-grid" id="categoryGrid">
                        ${expenseCategories.map(cat => `
                            <div class="category-item" data-id="${cat.id}">
                                <span class="category-icon">${cat.icon}</span>
                                <span class="category-name">${cat.nama}</span>
                            </div>
                        `).join('')}
                    </div>
                    <input type="hidden" id="inputKategori" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Jumlah (Rp)</label>
                    <input type="number" class="form-input" id="inputJumlah" placeholder="0" required min="1">
                    <div class="quick-amounts">
                        <button type="button" class="quick-amount" data-amount="10000">10rb</button>
                        <button type="button" class="quick-amount" data-amount="20000">20rb</button>
                        <button type="button" class="quick-amount" data-amount="50000">50rb</button>
                        <button type="button" class="quick-amount" data-amount="100000">100rb</button>
                        <button type="button" class="quick-amount" data-amount="500000">500rb</button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Keterangan (opsional)</label>
                    <input type="text" class="form-input" id="inputKeterangan" placeholder="Contoh: Makan siang">
                </div>

                <div class="form-group">
                    <label class="form-label">Input Oleh</label>
                    <select class="form-select" id="inputOleh" required>
                        ${this.familyMembers.map(name => `
                            <option value="${name}">${name}</option>
                        `).join('')}
                    </select>
                </div>

                <button type="submit" class="btn btn-primary">
                    💾 Simpan Transaksi
                </button>
            </form>

            <!-- Hidden data for JS -->
            <script type="application/json" id="expenseCategories">${JSON.stringify(expenseCategories)}</script>
            <script type="application/json" id="incomeCategories">${JSON.stringify(incomeCategories)}</script>
        `;
    },

    initInputPage() {
        const form = document.getElementById('transactionForm');
        const typeButtons = document.querySelectorAll('.type-btn');
        const categoryGrid = document.getElementById('categoryGrid');
        const quickAmounts = document.querySelectorAll('.quick-amount');

        // Type toggle
        typeButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                typeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTransactionType = btn.dataset.type;
                this.selectedCategory = null;
                document.getElementById('inputKategori').value = '';

                // Update categories
                const categories = btn.dataset.type === 'keluar'
                    ? JSON.parse(document.getElementById('expenseCategories').textContent)
                    : JSON.parse(document.getElementById('incomeCategories').textContent);

                categoryGrid.innerHTML = categories.map(cat => `
                    <div class="category-item" data-id="${cat.id}">
                        <span class="category-icon">${cat.icon}</span>
                        <span class="category-name">${cat.nama}</span>
                    </div>
                `).join('');

                this.initCategorySelection();
            });
        });

        // Category selection
        this.initCategorySelection();

        // Quick amounts
        quickAmounts.forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('inputJumlah').value = btn.dataset.amount;
            });
        });

        // Form submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const kategori = document.getElementById('inputKategori').value;
            if (!kategori) {
                this.showToast('Pilih kategori terlebih dahulu', 'error');
                return;
            }

            const transaction = {
                tanggal: document.getElementById('inputTanggal').value,
                tipe: this.currentTransactionType,
                kategori: kategori,
                jumlah: parseInt(document.getElementById('inputJumlah').value),
                keterangan: document.getElementById('inputKeterangan').value || '',
                inputOleh: document.getElementById('inputOleh').value
            };

            try {
                await DB.addTransaction(transaction);
                this.showToast('Transaksi berhasil disimpan! ✅', 'success');

                // Reset form
                document.getElementById('inputJumlah').value = '';
                document.getElementById('inputKeterangan').value = '';
                this.selectedCategory = null;
                document.getElementById('inputKategori').value = '';
                document.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));

                // Try to sync
                Sync.syncAll();
            } catch (error) {
                this.showToast('Gagal menyimpan: ' + error.message, 'error');
            }
        });
    },

    initCategorySelection() {
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));
                item.classList.add('active');
                this.selectedCategory = item.dataset.id;
                document.getElementById('inputKategori').value = item.dataset.id;
            });
        });
    },

    // LAPORAN PAGE
    async renderLaporanPage() {
        return `
            <div class="period-filter">
                <button class="period-btn" data-period="hari">Hari Ini</button>
                <button class="period-btn active" data-period="minggu">Minggu Ini</button>
                <button class="period-btn" data-period="bulan">Bulan Ini</button>
                <button class="period-btn" data-period="tahun">Tahun Ini</button>
            </div>

            <div id="reportContent">
                <!-- Will be loaded by initLaporanPage -->
            </div>
        `;
    },

    async initLaporanPage() {
        const periodButtons = document.querySelectorAll('.period-btn');

        periodButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                periodButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await this.loadReport(btn.dataset.period);
            });
        });

        // Load default (minggu)
        await this.loadReport('minggu');
    },

    async loadReport(period) {
        const content = document.getElementById('reportContent');
        content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const { start, end } = this.getDateRange(period);
        const stats = await DB.getStats(start, end);
        const transactions = await DB.getTransactionsByDateRange(start, end);
        const categories = await DB.getAllCategories();

        const catMap = {};
        categories.forEach(c => catMap[c.id] = c);

        // Calculate category breakdown
        const categoryBreakdown = [];
        for (const [catId, amounts] of Object.entries(stats.byCategory)) {
            const cat = catMap[catId] || { icon: '📦', nama: catId };
            categoryBreakdown.push({
                ...cat,
                total: amounts.keluar || amounts.masuk || 0,
                tipe: amounts.keluar ? 'keluar' : 'masuk'
            });
        }
        categoryBreakdown.sort((a, b) => b.total - a.total);

        content.innerHTML = `
            <div class="summary-grid">
                <div class="summary-card income">
                    <div class="summary-label">Total Masuk</div>
                    <div class="summary-amount">${this.formatCurrency(stats.totalMasuk)}</div>
                </div>
                <div class="summary-card expense">
                    <div class="summary-label">Total Keluar</div>
                    <div class="summary-amount">${this.formatCurrency(stats.totalKeluar)}</div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">Breakdown Kategori</div>
                ${categoryBreakdown.length > 0 ? `
                    <div class="category-list">
                        ${categoryBreakdown.map(cat => `
                            <div class="category-list-item">
                                <div class="category-icon">${cat.icon}</div>
                                <div class="category-info">
                                    <div class="category-name">${cat.nama}</div>
                                    <div class="category-type">${cat.tipe === 'keluar' ? 'Pengeluaran' : 'Pemasukan'}</div>
                                </div>
                                <div class="transaction-amount ${cat.tipe}">
                                    ${this.formatCurrency(cat.total)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <div class="empty-state-text">Tidak ada data untuk periode ini</div>
                    </div>
                `}
            </div>

            <div class="card">
                <div class="card-title">Semua Transaksi (${transactions.length})</div>
                ${transactions.length > 0 ? `
                    <div class="transaction-list">
                        ${transactions.map(tx => {
            const cat = catMap[tx.kategori] || { icon: '📦', nama: tx.kategori };
            return `
                                <div class="transaction-item" data-id="${tx.id}">
                                    <div class="transaction-icon">${cat.icon}</div>
                                    <div class="transaction-info">
                                        <div class="transaction-category">${cat.nama}</div>
                                        <div class="transaction-detail">
                                            <span>${this.formatDate(tx.tanggal)}</span>
                                            <span>• ${tx.inputOleh}</span>
                                            ${tx.keterangan ? `<span>• ${tx.keterangan}</span>` : ''}
                                        </div>
                                    </div>
                                    <div class="transaction-amount ${tx.tipe}">
                                        ${tx.tipe === 'masuk' ? '+' : '-'}${this.formatCurrency(tx.jumlah)}
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    // KATEGORI PAGE
    async renderKategoriPage() {
        const categories = await DB.getAllCategories();
        const expenseCategories = categories.filter(c => c.tipe === 'keluar');
        const incomeCategories = categories.filter(c => c.tipe === 'masuk');

        return `
            <div class="card">
                <div class="card-title">📤 Kategori Pengeluaran</div>
                <div class="category-list">
                    ${expenseCategories.map(cat => `
                        <div class="category-list-item">
                            <div class="category-icon">${cat.icon}</div>
                            <div class="category-info">
                                <div class="category-name">${cat.nama}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="card">
                <div class="card-title">📥 Kategori Pemasukan</div>
                <div class="category-list">
                    ${incomeCategories.map(cat => `
                        <div class="category-list-item">
                            <div class="category-icon">${cat.icon}</div>
                            <div class="category-info">
                                <div class="category-name">${cat.nama}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="card">
                <div class="card-title">⚙️ Pengaturan Sinkronisasi</div>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: var(--spacing-md);">
                    ${Sync.isConfigured() ? '✅ Sudah terhubung ke Google Sheets' : '⚠️ Belum dikonfigurasi'}
                </p>
                <button class="btn btn-secondary" onclick="App.showSyncSetup()">
                    ${Sync.isConfigured() ? 'Ubah Konfigurasi' : 'Konfigurasi Sekarang'}
                </button>
            </div>
        `;
    }
};
