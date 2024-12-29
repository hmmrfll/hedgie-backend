// utils/dbInit.js
const pool = require('../config/database');

async function checkTableExists(tableName) {
    const query = `
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        );
    `;
    const { rows } = await pool.query(query, [tableName]);
    return rows[0].exists;
}

async function initializeDatabase() {
    try {
        console.log('Checking database structure...');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Создаем таблицу users, если её нет
            const usersExists = await checkTableExists('users');
            if (!usersExists) {
                console.log('Creating users table...');
                await client.query(`
                    CREATE TABLE users (
                        id SERIAL PRIMARY KEY,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password VARCHAR(255) NOT NULL,
                        first_name VARCHAR(255),
                        last_name VARCHAR(255),
                        is_active BOOLEAN DEFAULT true,
                        is_email_verified BOOLEAN DEFAULT false,
                        verification_token VARCHAR(255),
                        reset_password_token VARCHAR(255),
                        reset_password_expires TIMESTAMP,
                        login_attempts INTEGER DEFAULT 0,
                        lock_until TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
            }

            // Создаем таблицу ролей, если её нет
            const rolesExists = await checkTableExists('roles');
            if (!rolesExists) {
                console.log('Creating roles table...');
                await client.query(`
                    CREATE TABLE roles (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(50) UNIQUE NOT NULL,
                        description VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // Добавляем базовые роли
                await client.query(`
                    INSERT INTO roles (name, description) VALUES
                        ('ADMIN', 'System Administrator'),
                        ('USER', 'Regular User'),
                        ('PREMIUM', 'Premium User');
                `);
            }

            // Создаем таблицу user_roles, если её нет
            const userRolesExists = await checkTableExists('user_roles');
            if (!userRolesExists) {
                console.log('Creating user_roles table...');
                await client.query(`
                    CREATE TABLE user_roles (
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
                        PRIMARY KEY (user_id, role_id)
                    );
                `);
            }

            // Создаем таблицу refresh_tokens, если её нет
            const refreshTokensExists = await checkTableExists('refresh_tokens');
            if (!refreshTokensExists) {
                console.log('Creating refresh_tokens table...');
                await client.query(`
                    CREATE TABLE refresh_tokens (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        token VARCHAR(255) NOT NULL,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
            }

            // Создаем администратора, если его нет
            const adminExists = await client.query(
                "SELECT EXISTS(SELECT 1 FROM users WHERE email = 'admin@example.com');"
            );

            if (!adminExists.rows[0].exists) {
                console.log('Creating admin user...');
                const bcrypt = require('bcryptjs');
                const adminPassword = await bcrypt.hash('admin123', 10);

                const { rows: [admin] } = await client.query(
                    `INSERT INTO users (email, password, first_name, last_name, is_email_verified)
                     VALUES ($1, $2, $3, $4, true)
                     RETURNING id;`,
                    ['admin@example.com', adminPassword, 'Admin', 'User']
                );

                const { rows: [adminRole] } = await client.query(
                    "SELECT id FROM roles WHERE name = 'ADMIN';"
                );

                await client.query(
                    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);',
                    [admin.id, adminRole.id]
                );
            }

            await client.query('COMMIT');
            console.log('Database initialization completed successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

module.exports = initializeDatabase;