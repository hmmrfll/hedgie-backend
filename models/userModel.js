// models/userModel.js
const pool = require('../config/database');

class UserModel {
    async create({ email, password, firstName, lastName }) {
        const query = `
            INSERT INTO users (email, password, first_name, last_name)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, first_name, last_name;
        `;
        const values = [email, password, firstName, lastName];
        const { rows } = await pool.query(query, values);
        return rows[0];
    }

    async findByEmail(email) {
        const query = `
            SELECT u.*, array_agg(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.email = $1
            GROUP BY u.id;
        `;
        const { rows } = await pool.query(query, [email]);
        return rows[0];
    }

    async addRole(userId, roleName) {
        const query = `
            INSERT INTO user_roles (user_id, role_id)
            SELECT $1, r.id FROM roles r WHERE r.name = $2;
        `;
        await pool.query(query, [userId, roleName]);
    }

    async updateLoginAttempts(userId, attempts, lockUntil = null) {
        const query = `
            UPDATE users
            SET login_attempts = $2, lock_until = $3
            WHERE id = $1;
        `;
        await pool.query(query, [userId, attempts, lockUntil]);
    }

    async findById(userId) {
        const query = `
            SELECT u.*, array_agg(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id = $1
            GROUP BY u.id;
        `;
        const { rows } = await pool.query(query, [userId]);
        return rows[0];
    }

    // Методы для работы с токеном восстановления пароля

    async updatePasswordResetToken(userId, token, expiration) {
        const query = `
            UPDATE users
            SET reset_token = $1, reset_token_expiration = $2
            WHERE id = $3;
        `;
        await pool.query(query, [token, expiration, userId]);
    }

    async findByResetToken(token) {
        const query = `
            SELECT * FROM users
            WHERE reset_token = $1 AND reset_token_expiration > NOW();
        `;
        const { rows } = await pool.query(query, [token]);
        return rows[0];
    }

    async updatePassword(userId, hashedPassword) {
        const query = `
            UPDATE users
            SET password = $1
            WHERE id = $2;
        `;
        await pool.query(query, [hashedPassword, userId]);
    }

    async clearPasswordResetToken(userId) {
        const query = `
            UPDATE users
            SET reset_token = NULL, reset_token_expiration = NULL
            WHERE id = $1;
        `;
        await pool.query(query, [userId]);
    }
}

module.exports = new UserModel();
