// services/tokenService.js
const jwt = require('jsonwebtoken');
const pool = require('../cmd/db');

class TokenService {
	generateTokens(userId, roles) {
		const accessToken = jwt.sign({ userId, roles }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '15m' });

		const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key', {
			expiresIn: '7d',
		});

		return { accessToken, refreshToken };
	}

	async saveRefreshToken(userId, token) {
		const query = `
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '7 days')
        `;
		await pool.query(query, [userId, token]);
	}

	validateAccessToken(token) {
		try {
			return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
		} catch {
			return null;
		}
	}

	validateRefreshToken(token) {
		try {
			return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key');
		} catch {
			return null;
		}
	}

	async removeRefreshToken(token) {
		const query = 'DELETE FROM refresh_tokens WHERE token = $1';
		await pool.query(query, [token]);
	}

	async findRefreshToken(token) {
		const query = `
            SELECT * FROM refresh_tokens
            WHERE token = $1 AND expires_at > NOW()
        `;
		const { rows } = await pool.query(query, [token]);
		return rows[0];
	}
}

module.exports = new TokenService();
