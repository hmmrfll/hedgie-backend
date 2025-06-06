const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const Logger = require('../internal/shared/logger/logger');
const DatabaseManager = require('./db');

const authRoutes = require('../routes/authRoutes');

const metricsRoutes = require('../routes/overviewRoutes/metricsRoutes');
const popularOptionsRouter = require('../routes/overviewRoutes/popularOptionsRouter');
const strikeActivityRouter = require('../routes/overviewRoutes/strikeActivityRouter');
const expirationActivityRouter = require('../routes/overviewRoutes/expirationActivityRouter');
const timeDistributionRouter = require('../routes/overviewRoutes/timeDistributionRouter');
const keyMetricsRouter = require('../routes/overviewRoutes/keyMetricsRouter');
const popularOptionByVolumeRouter = require('../routes/overviewRoutes/popularOptionByVolumeRouter');

const blockTradesRouter = require('../routes/blockTradesRoutes/blockTradesRouter');
const popularOptionsBlockTradesRouter = require('../routes/blockTradesRoutes/popularOptionsBlockTradesRouter');
const strikeActivityBlockTradesRouter = require('../routes/blockTradesRoutes/strikeActivityBlockTradesRouter');
const expirationActivityBlockTradesRouter = require('../routes/blockTradesRoutes/expirationActivityBlockTradesRouter');
const timeDistributionBlockTradesRouter = require('../routes/blockTradesRoutes/timeDistributionBlockTradesRouter');
const keyMetricsBlockTradesRouter = require('../routes/blockTradesRoutes/keyMetricsBlockTradesRouter');
const popularOptionByVolumeBlockTradesRouter = require('../routes/blockTradesRoutes/popularOptionByVolumeBlockTradesRouter');

const maxPainRoutes = require('../routes/maxPainRoutes');
const expirationRouter = require('../routes/expirationRoutes');
const strikeRouter = require('../routes/strikeRouter');

const flowDataRouter = require('../routes/flowRoutes/flowDataRouter');
const flowMetricsRouter = require('../routes/flowRoutes/flowMetricsRouter');
const lastDataRouter = require('../routes/flowRoutes/lastDataRouter');
const blockFlowDataRouter = require('../routes/blockFlowRoutes/blockFlowDataRouter');

const openInterest = require('../routes/openInterestRoutes/openInterest');
const openInterestByExpirationRouter = require('../routes/openInterestRoutes/openInterestByExpirationRouter');
const openInterestByStrikeRouter = require('../routes/openInterestRoutes/openInterestByStrikeRouter');
const openInterestDeltaAdjusted = require('../routes/openInterestRoutes/openInterestDeltaAdjusted');
const openInterestHistorical = require('../routes/openInterestRoutes/openInterestHistorical');

const volumeInterestRouter = require('../routes/volumeRoutes/volumeInterestRouter');
const volumeByExpirationRouter = require('../routes/volumeRoutes/volumeByExpirationRouter');
const volumeByStrikeRouter = require('../routes/volumeRoutes/volumeByStrikeRouter');
const volumePopularOptionsRouter = require('../routes/volumeRoutes/volumePopularOptionsRouter');

const dataDownload = require('../routes/dataLabRoutes/dataDownload');

const aiAnalysisRoutes = require('../routes/aiAnalysisRoutes');

class Application {
    constructor() {
        this.app = express();
        this.server = null;
        this.logger = new Logger();
        this.db = null;
    }

    async initialize() {
        try {
            this.logger.info('🚀 Starting Deribit Options Analytics Server...');
            this.logger.info(`📊 Environment: ${config.app.env}`);
            this.logger.info(`🔗 Port: ${config.app.port}`);

            this.validateConfig();

            this.db = new DatabaseManager(config, this.logger);
            await this.db.init();

            this.setupMiddleware();
            this.setupRoutes();
            this.setupErrorHandling();

            return true;
        } catch (error) {
            this.logger.error('❌ Failed to initialize application:', error.message);
            return false;
        }
    }

    validateConfig() {
        const requiredEnvVars = [
            'PG_USER',
            'PG_PASSWORD',
            'PG_HOST',
            'PG_DATABASE',
            'PG_PORT',
            'JWT_SECRET'
        ];

        const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        this.logger.info('✅ Configuration validated successfully');
    }

    setupMiddleware() {
        this.app.use(cors(config.cors));

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`);
            next();
        });

        this.app.get('/health', async (req, res) => {
            try {
                const dbStatus = await this.db.testConnection();
                res.json({
                    status: dbStatus ? 'OK' : 'ERROR',
                    database: dbStatus ? 'connected' : 'disconnected',
                    timestamp: new Date().toISOString(),
                    environment: config.app.env,
                    version: process.env.npm_package_version || '1.0.0'
                });
            } catch (error) {
                this.logger.error('Health check failed:', error);
                res.status(500).json({
                    status: 'ERROR',
                    database: 'error',
                    timestamp: new Date().toISOString(),
                    error: error.message
                });
            }
        });

        this.app.use('/static', express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        this.app.use('/api', authRoutes);

        this.app.use('/api', maxPainRoutes);
        this.app.use('/api', expirationRouter);
        this.app.use('/api', strikeRouter);
        this.app.use('/api', flowDataRouter);
        this.app.use('/api', openInterestDeltaAdjusted);
        this.app.use('/api', openInterestHistorical);

        this.app.use('/api/ai', aiAnalysisRoutes);

        this.app.use('/api/metrics',
            metricsRoutes,
            popularOptionsRouter,
            strikeActivityRouter,
            expirationActivityRouter,
            timeDistributionRouter,
            keyMetricsRouter,
            popularOptionByVolumeRouter
        );

        this.app.use('/api/block-trades',
            blockTradesRouter,
            popularOptionsBlockTradesRouter,
            strikeActivityBlockTradesRouter,
            expirationActivityBlockTradesRouter,
            timeDistributionBlockTradesRouter,
            keyMetricsBlockTradesRouter,
            popularOptionByVolumeBlockTradesRouter
        );

        this.app.use('/api/open-interest',
            openInterest,
            openInterestByExpirationRouter,
            openInterestByStrikeRouter
        );

        this.app.use('/api/volume',
            volumeInterestRouter,
            volumeByExpirationRouter,
            volumeByStrikeRouter,
            volumePopularOptionsRouter
        );

        this.app.use('/api/flow',
            flowMetricsRouter,
            lastDataRouter
        );

        this.app.use('/api/block/flow', blockFlowDataRouter);

        this.app.use('/api/datalab', dataDownload);

        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Deribit Options Analytics API',
                version: '1.0.0',
                description: 'API for analyzing Deribit options trading data',
                endpoints: {
                    health: '/health',
                    auth: '/api/auth/*',
                    metrics: '/api/metrics/*',
                    blockTrades: '/api/block-trades/*',
                    openInterest: '/api/open-interest/*',
                    volume: '/api/volume/*',
                    flow: '/api/flow/*',
                    blockFlow: '/api/block/flow/*',
                    datalab: '/api/datalab/*',
                    ai: '/api/ai/*'
                },
                timestamp: new Date().toISOString()
            });
        });

        this.app.use('*', (req, res) => {
            this.logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
            res.status(404).json({
                error: 'Route not found',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupErrorHandling() {
        this.app.use((error, req, res, next) => {
            this.logger.error('❌ Unhandled error:', error);

            const isDevelopment = config.app.env === 'development';

            res.status(error.status || 500).json({
                error: isDevelopment ? error.message : 'Internal server error',
                timestamp: new Date().toISOString(),
                path: req.originalUrl,
                method: req.method,
                ...(isDevelopment && { stack: error.stack })
            });
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            this.logger.error('🚨 Uncaught Exception:', error);
            this.gracefulShutdown();
        });
    }

    async start() {
        try {
            const initialized = await this.initialize();
            if (!initialized) {
                process.exit(1);
            }

            this.server = this.app.listen(config.app.port, '0.0.0.0', () => {
                this.logger.info('🎉 Server started successfully!');
                this.logger.info(`🌐 Server running at: http://localhost:${config.app.port}`);
                this.logger.info(`📋 Health check: http://localhost:${config.app.port}/health`);
                this.logger.info(`📚 API docs: http://localhost:${config.app.port}/api`);
                this.logger.info('📊 Ready to process options data...');
            });

            process.on('SIGTERM', () => this.gracefulShutdown());
            process.on('SIGINT', () => this.gracefulShutdown());

        } catch (error) {
            this.logger.error('❌ Failed to start server:', error.message);
            process.exit(1);
        }
    }

    async gracefulShutdown() {
        this.logger.info('\n🛑 Initiating graceful shutdown...');

        try {
            if (this.server) {
                this.logger.info('🔄 Closing HTTP server...');
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
            }

            this.logger.info('✅ Graceful shutdown completed');
            process.exit(0);

        } catch (error) {
            this.logger.error('❌ Error during shutdown:', error.message);
            process.exit(1);
        }
    }

    getDatabase() {
        return this.db;
    }
}

const app = new Application();
app.start();

module.exports = app;
