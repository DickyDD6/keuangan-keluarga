/**
 * Auth Module - Login System
 * Handles authentication, session management, and password hashing
 */

const Auth = {
    currentUser: null,

    // Initialize auth system
    async init() {
        // Check if user logged in
        const session = this.getSession();
        if (session) {
            const user = await DB.getUserByUsername(session.username);
            if (user) {
                this.currentUser = user;
                return true;
            }
        }
        return false;
    },

    // Hash password using SHA-256
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // Login
    async login(username, password) {
        const user = await DB.getUserByUsername(username.toLowerCase());

        if (!user) {
            throw new Error('Username atau password salah');
        }

        const hashedPassword = await this.hashPassword(password);
        if (user.password !== hashedPassword) {
            throw new Error('Username atau password salah');
        }

        // Update last login
        await DB.updateUser(user.id, { lastLogin: new Date().toISOString() });

        // Save session
        this.currentUser = user;
        this.saveSession(user.username);

        return user;
    },

    // Logout
    logout() {
        this.currentUser = null;
        localStorage.removeItem('authSession');
        window.location.reload();
    },

    // Check if user is logged in
    isLoggedIn() {
        return !!this.currentUser;
    },

    // Check if current user is admin
    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    // Save session to localStorage
    saveSession(username) {
        const session = {
            username: username,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('authSession', JSON.stringify(session));
    },

    // Get session from localStorage
    getSession() {
        const sessionData = localStorage.getItem('authSession');
        if (!sessionData) return null;

        try {
            return JSON.parse(sessionData);
        } catch (e) {
            return null;
        }
    },

    // Create admin user (first-time setup)
    async setupAdmin(username, password) {
        // Check if password is strong enough
        if (password.length < 4) {
            throw new Error('Password minimal 4 karakter');
        }

        const hashedPassword = await this.hashPassword(password);

        const admin = {
            id: 'user_' + username,
            username: username.toLowerCase(),
            displayName: username.charAt(0).toUpperCase() + username.slice(1),
            password: hashedPassword,
            role: 'admin'
        };

        await DB.addUser(admin);
        return admin;
    },

    // Create regular user (by admin)
    async createUser(username, displayName, password) {
        if (!this.isAdmin()) {
            throw new Error('Only admin can create users');
        }

        if (password.length < 4) {
            throw new Error('Password minimal 4 karakter');
        }

        const hashedPassword = await this.hashPassword(password);

        const user = {
            id: 'user_' + username.toLowerCase(),
            username: username.toLowerCase(),
            displayName: displayName,
            password: hashedPassword,
            role: 'user'
        };

        await DB.addUser(user);
        return user;
    },

    // Reset password (by admin)
    async resetPassword(userId, newPassword) {
        if (!this.isAdmin()) {
            throw new Error('Only admin can reset passwords');
        }

        if (newPassword.length < 4) {
            throw new Error('Password minimal 4 karakter');
        }

        const hashedPassword = await this.hashPassword(newPassword);
        await DB.updateUser(userId, { password: hashedPassword });
    },

    // Check if any users exist
    async hasUsers() {
        const users = await DB.getAllUsers();
        return users.length > 0;
    }
};
