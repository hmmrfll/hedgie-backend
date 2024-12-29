// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken, hasRole } = require('../middlewares/authMiddleware');

// Публичные маршруты
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.post('/auth/refresh', AuthController.refresh);
router.post('/auth/logout', AuthController.logout);
router.post('/auth/google', AuthController.googleAuth);

// Добавленные маршруты для восстановления пароля
router.post('/auth/forgot-password', AuthController.forgotPassword); // Запрос на восстановление
router.post('/auth/reset-password', AuthController.resetPassword);   // Сброс пароля


// Защищенные маршруты
router.get('/auth/me', authenticateToken, AuthController.getCurrentUser);

// Админские маршруты
router.get('/admin/users', authenticateToken, hasRole(['ADMIN']), async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, 
                   array_agg(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id, u.email, u.first_name, u.last_name, u.is_active
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});
router.put('/admin/users/:id/activate', authenticateToken, hasRole(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('UPDATE users SET is_active = true WHERE id = $1', [id]);
        res.json({ message: 'User activated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to activate user' });
    }
});
router.put('/admin/users/:id/deactivate', authenticateToken, hasRole(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to deactivate user' });
    }
});
router.put('/admin/users/:id/roles', authenticateToken, hasRole(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { roles } = req.body;

        await pool.query('BEGIN');
        await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]);

        for (const roleName of roles) {
            await pool.query(
                'INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = $2',
                [id, roleName]
            );
        }

        await pool.query('COMMIT');
        res.json({ message: 'User roles updated successfully' });
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to update user roles' });
    }
});

module.exports = router;