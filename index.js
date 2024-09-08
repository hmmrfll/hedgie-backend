require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const blockTradesRouter = require('./routes/blockTradesRouter');
const maxPainRoutes = require('./routes/maxPainRoutes'); // Добавляем этот импорт
const popularOptionsRouter = require('./routes/popularOptionsRouter');
const strikeActivityRouter = require('./routes/strikeActivityRouter');
const expirationRouter = require('./routes/expirationRoutes');
const expirationActivityRouter = require('./routes/expirationActivityRouter');
const strikeRouter = require('./routes/strikeRouter');
const timeDistributionRouter = require('./routes/timeDistributionRouter');
const keyMetricsRouter = require('./routes/keyMetricsRouter');
const flowDataRouter = require('./routes/flowDataRouter');



const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api', authRoutes);
app.use('/api/metrics', metricsRoutes, popularOptionsRouter ,strikeActivityRouter, expirationActivityRouter, timeDistributionRouter,keyMetricsRouter);
app.use('/api/block-trades', blockTradesRouter);
app.use('/api', maxPainRoutes, expirationRouter, strikeRouter, flowDataRouter);



const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
