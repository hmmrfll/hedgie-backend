// models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Импортируем подключение к базе данных

const User = sequelize.define('User', {
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'users', // Название таблицы в базе данных
    timestamps: false // Не добавляем временные метки (createdAt, updatedAt)
});

module.exports = User;
