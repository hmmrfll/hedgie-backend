// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const pool = require('../cmd/db');

// Middleware для проверки JWT токена
const authenticateToken = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			return res.status(401).json({ message: 'Authorization header missing' });
		}

		const token = authHeader.split(' ')[1];
		if (!token) {
			return res.status(401).json({ message: 'Token missing' });
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
		req.user = decoded;
		next();
	} catch (error) {
		return res.status(401).json({ message: 'Invalid token' });
	}
};

// Middleware для проверки ролей
const hasRole = (allowedRoles) => {
	return async (req, res, next) => {
		try {
			if (!req.user) {
				return res.status(401).json({ message: 'User not authenticated' });
			}

			// Получаем роли пользователя из базы данных
			const query = `
                SELECT r.name
                FROM roles r
                JOIN user_roles ur ON r.id = ur.role_id
                WHERE ur.user_id = $1
            `;
			const { rows } = await pool.query(query, [req.user.userId]);

			const userRoles = rows.map((row) => row.name);

			// Проверяем, есть ли у пользователя хотя бы одна из разрешенных ролей
			const hasPermission = allowedRoles.some((role) => userRoles.includes(role));

			if (!hasPermission) {
				return res.status(403).json({ message: 'Access denied: insufficient permissions' });
			}

			next();
		} catch (error) {
			console.error('Role check error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	};
};

module.exports = {
	authenticateToken,
	hasRole,
};
