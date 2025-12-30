/**
 * Database Module - IndexedDB Wrapper
 * Handles offline storage for transactions and categories
 */

const DB = {
    name: 'KeuanganKeluargaDB',
    version: 2, // Updated for users support
    db: null,

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.name, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    txStore.createIndex('tanggal', 'tanggal', { unique: false });
                    txStore.createIndex('tipe', 'tipe', { unique: false });
                    txStore.createIndex('kategori', 'kategori', { unique: false });
                    txStore.createIndex('synced', 'synced', { unique: false });
                }

                // Categories store
                if (!db.objectStoreNames.contains('categories')) {
                    const catStore = db.createObjectStore('categories', { keyPath: 'id' });
                    catStore.createIndex('tipe', 'tipe', { unique: false });
                }

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Users store (NEW for login system)
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('username', 'username', { unique: true });
                    userStore.createIndex('role', 'role', { unique: false });
                }
            };
        });
    },

    // Generate unique ID
    generateId() {
        return 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // TRANSACTIONS CRUD

    async addTransaction(transaction) {
        const tx = {
            id: this.generateId(),
            ...transaction,
            createdAt: new Date().toISOString(),
            synced: false
        };

        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['transactions'], 'readwrite');
            const store = txn.objectStore('transactions');
            const request = store.add(tx);

            request.onsuccess = () => resolve(tx);
            request.onerror = () => reject(request.error);
        });
    },

    async updateTransaction(id, updates) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['transactions'], 'readwrite');
            const store = txn.objectStore('transactions');
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const transaction = getRequest.result;
                if (transaction) {
                    const updated = { ...transaction, ...updates, synced: false };
                    const putRequest = store.put(updated);
                    putRequest.onsuccess = () => resolve(updated);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    reject(new Error('Transaction not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    async deleteTransaction(id) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['transactions'], 'readwrite');
            const store = txn.objectStore('transactions');
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    async getTransaction(id) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['transactions'], 'readonly');
            const store = txn.objectStore('transactions');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllTransactions() {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['transactions'], 'readonly');
            const store = txn.objectStore('transactions');
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by date descending
                const transactions = request.result.sort((a, b) =>
                    new Date(b.tanggal) - new Date(a.tanggal)
                );
                resolve(transactions);
            };
            request.onerror = () => reject(request.error);
        });
    },

    async getTransactionsByDateRange(startDate, endDate) {
        const all = await this.getAllTransactions();
        return all.filter(tx => {
            const date = new Date(tx.tanggal);
            return date >= startDate && date <= endDate;
        });
    },

    async getUnsyncedTransactions() {
        // Get all transactions and filter for unsynced ones
        // (IndexedDB doesn't handle boolean index queries reliably)
        const all = await this.getAllTransactions();
        return all.filter(tx => tx.synced === false || tx.synced === undefined);
    },

    async markAsSynced(id) {
        return this.updateTransaction(id, { synced: true, syncedAt: new Date().toISOString() });
    },

    // CATEGORIES

    async initDefaultCategories() {
        const existing = await this.getAllCategories();
        if (existing.length > 0) return;

        const defaultCategories = [
            // Pengeluaran
            { id: 'cicilan', nama: 'Cicilan', icon: '💳', tipe: 'keluar' },
            { id: 'arisan_bayar', nama: 'Iuran Arisan', icon: '🤝', tipe: 'keluar' },
            { id: 'makan', nama: 'Makan & Minum', icon: '🍔', tipe: 'keluar' },
            { id: 'transport', nama: 'Transportasi', icon: '🚗', tipe: 'keluar' },
            { id: 'tagihan', nama: 'Tagihan', icon: '📄', tipe: 'keluar' },
            { id: 'belanja', nama: 'Belanja', icon: '🛒', tipe: 'keluar' },
            { id: 'hiburan', nama: 'Hiburan', icon: '🎮', tipe: 'keluar' },
            { id: 'kesehatan', nama: 'Kesehatan', icon: '💊', tipe: 'keluar' },
            { id: 'pendidikan', nama: 'Pendidikan', icon: '📚', tipe: 'keluar' },
            { id: 'lainnya_keluar', nama: 'Lainnya', icon: '📦', tipe: 'keluar' },
            // Pemasukan
            { id: 'gaji', nama: 'Gaji', icon: '💰', tipe: 'masuk' },
            { id: 'arisan_dapat', nama: 'Dapat Arisan', icon: '🎉', tipe: 'masuk' },
            { id: 'bonus', nama: 'Bonus', icon: '🎁', tipe: 'masuk' },
            { id: 'investasi', nama: 'Investasi', icon: '📈', tipe: 'masuk' },
            { id: 'lainnya_masuk', nama: 'Lainnya', icon: '💵', tipe: 'masuk' }
        ];

        const txn = this.db.transaction(['categories'], 'readwrite');
        const store = txn.objectStore('categories');

        for (const cat of defaultCategories) {
            store.add(cat);
        }

        return new Promise((resolve, reject) => {
            txn.oncomplete = () => resolve();
            txn.onerror = () => reject(txn.error);
        });
    },

    async getAllCategories() {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['categories'], 'readonly');
            const store = txn.objectStore('categories');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getCategoriesByType(tipe) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['categories'], 'readonly');
            const store = txn.objectStore('categories');
            const index = store.index('tipe');
            const request = index.getAll(tipe);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async addCategory(category) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['categories'], 'readwrite');
            const store = txn.objectStore('categories');
            const request = store.add(category);

            request.onsuccess = () => resolve(category);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteCategory(id) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['categories'], 'readwrite');
            const store = txn.objectStore('categories');
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    // SETTINGS

    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['settings'], 'readonly');
            const store = txn.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    },

    async setSetting(key, value) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['settings'], 'readwrite');
            const store = txn.objectStore('settings');
            const request = store.put({ key, value });

            request.onsuccess = () => resolve(value);
            request.onerror = () => reject(request.error);
        });
    },

    // STATISTICS

    async getStats(startDate, endDate) {
        const transactions = await this.getTransactionsByDateRange(startDate, endDate);

        let totalMasuk = 0;
        let totalKeluar = 0;
        const byCategory = {};

        transactions.forEach(tx => {
            if (tx.tipe === 'masuk') {
                totalMasuk += tx.jumlah;
            } else {
                totalKeluar += tx.jumlah;
            }

            if (!byCategory[tx.kategori]) {
                byCategory[tx.kategori] = { masuk: 0, keluar: 0 };
            }
            byCategory[tx.kategori][tx.tipe] += tx.jumlah;
        });

        return {
            totalMasuk,
            totalKeluar,
            saldo: totalMasuk - totalKeluar,
            byCategory,
            transactionCount: transactions.length
        };
    },

    // ===== USER MANAGEMENT (for Login System) =====

    // Add new user
    async addUser(user) {
        const tx = this.db.transaction(['users'], 'readwrite');
        const store = tx.objectStore('users');

        user.createdAt = new Date().toISOString();
        user.lastLogin = null;

        await store.add(user);
        return user;
    },

    // Get user by ID
    async getUser(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['users'], 'readonly');
            const store = tx.objectStore('users');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get user by username
    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['users'], 'readonly');
            const store = tx.objectStore('users');
            const index = store.index('username');
            const request = index.get(username);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get all users
    async getAllUsers() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['users'], 'readonly');
            const store = tx.objectStore('users');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Update user
    async updateUser(id, updates) {
        const tx = this.db.transaction(['users'], 'readwrite');
        const store = tx.objectStore('users');

        const user = await store.get(id);
        if (!user) throw new Error('User not found');

        Object.assign(user, updates);
        await store.put(user);
        return user;
    },

    // Delete user
    async deleteUser(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['users'], 'readwrite');
            const store = tx.objectStore('users');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};
