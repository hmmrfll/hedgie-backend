// controllers/authController.js
const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');
const TokenService = require('../services/tokenService');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const sendEmail = require('../services/emailService'); // Предполагаем, что у вас есть email-сервис
const crypto = require('crypto');

class AuthController {
    async register(req, res) {
        try {
            const { email, password, firstName, lastName } = req.body;

            // Проверка существования пользователя
            const existingUser = await UserModel.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({ message: 'User already exists' });
            }

            // Хэширование пароля
            const hashedPassword = await bcrypt.hash(password, 10);

            // Создание пользователя
            const user = await UserModel.create({
                email,
                password: hashedPassword,
                firstName,
                lastName
            });

            // Добавление роли USER
            await UserModel.addRole(user.id, 'USER');

            // Генерация токенов
            const tokens = TokenService.generateTokens(user.id, ['USER']);
            await TokenService.saveRefreshToken(user.id, tokens.refreshToken);

            res.status(201).json({
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName
                },
                ...tokens
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ message: 'Registration failed' });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = await UserModel.findByEmail(email);
            if (!user) {
                return res.status(400).json({ message: 'User not found' });
            }

            // Проверка блокировки
            if (user.lock_until && new Date(user.lock_until) > new Date()) {
                return res.status(423).json({
                    message: 'Account is locked',
                    lockUntil: user.lock_until
                });
            }

            // Проверка пароля
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                const attempts = (user.login_attempts || 0) + 1;
                let lockUntil = null;

                if (attempts >= 5) {
                    lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
                }

                await UserModel.updateLoginAttempts(user.id, attempts, lockUntil);

                return res.status(400).json({ message: 'Invalid password' });
            }

            // Сброс попыток входа
            await UserModel.updateLoginAttempts(user.id, 0, null);

            // Генерация токенов
            const tokens = TokenService.generateTokens(user.id, user.roles);
            await TokenService.saveRefreshToken(user.id, tokens.refreshToken);

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    roles: user.roles
                },
                ...tokens
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'Login failed' });
        }
    }

    async refresh(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({ message: 'Refresh token is required' });
            }

            const userData = TokenService.validateRefreshToken(refreshToken);
            if (!userData) {
                return res.status(401).json({ message: 'Invalid refresh token' });
            }

            const savedToken = await TokenService.findRefreshToken(refreshToken);
            if (!savedToken) {
                return res.status(401).json({ message: 'Refresh token not found' });
            }

            const user = await UserModel.findByEmail(userData.email);
            const tokens = TokenService.generateTokens(user.id, user.roles);
            await TokenService.saveRefreshToken(user.id, tokens.refreshToken);

            res.json(tokens);
        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(500).json({ message: 'Token refresh failed' });
        }
    }

    async getCurrentUser(req, res) {
        try {
            const user = await UserModel.findById(req.user.userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    roles: user.roles?.filter(role => role) || [] // Фильтруем null значения
                }
            });
        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({ message: 'Failed to get user data' });
        }
    }

    async logout(req, res) {
        try {
            const { refreshToken } = req.body;
            await TokenService.removeRefreshToken(refreshToken);
            res.json({ message: 'Successfully logged out' });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ message: 'Failed to logout' });
        }
    }

    async googleAuth(req, res) {
        try {
            const { credential } = req.body;

            // Верифицируем токен от Google
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const { email, name, sub: googleId } = ticket.getPayload();

            // Ищем пользователя или создаем нового
            let user = await UserModel.findByEmail(email);

            if (!user) {
                // Создаем нового пользователя
                user = await UserModel.create({
                    email,
                    firstName: name,
                    password: crypto.randomBytes(32).toString('hex'), // генерируем случайный пароль
                    isEmailVerified: true // email уже подтвержден через Google
                });

                await UserModel.addRole(user.id, 'USER');
            }

            // Генерируем токены
            const tokens = TokenService.generateTokens(user.id, user.roles);
            await TokenService.saveRefreshToken(user.id, tokens.refreshToken);

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    roles: user.roles
                },
                ...tokens
            });
        } catch (error) {
            console.error('Google auth error:', error);
            res.status(500).json({ message: 'Google authentication failed' });
        }
    }

// controllers/authController.js
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const user = await UserModel.findByEmail(email);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiration = new Date(Date.now() + 3600000); // 1 час

            await UserModel.updatePasswordResetToken(user.id, resetToken, resetTokenExpiration);

            await sendEmail({
                to: email,
                subject: 'Password Reset',
                resetToken,
                resetLink: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
            });

            res.json({ message: 'Password reset email sent' });
        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({ message: 'Failed to process request' });
        }
    }    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;

            // Ищем пользователя по токену
            const user = await UserModel.findByResetToken(token);
            if (!user || user.resetTokenExpiration < new Date()) {
                return res.status(400).json({ message: 'Invalid or expired token' });
            }

            // Хэшируем новый пароль
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Сбрасываем пароль и удаляем токен
            await UserModel.updatePassword(user.id, hashedPassword);
            await UserModel.clearPasswordResetToken(user.id);

            res.status(200).json({ message: 'Password has been reset successfully' });
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({ message: 'Failed to reset password' });
        }
    }

}

module.exports = new AuthController();