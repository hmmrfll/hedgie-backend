const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
	app: {
		port: process.env.BACKEND_LOCAL_PORT,
		env: process.env.NODE_ENV || 'development',
		frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
	},

	database: {
		user: process.env.PG_USER || 'admin',
		password: process.env.PG_PASSWORD || 'admin123',
		host: process.env.PG_HOST || 'localhost',
		database: process.env.PG_DATABASE || 'deribit_trades',
		port: parseInt(process.env.PG_PORT) || 5432,
	},

	jwt: {
		secret: process.env.JWT_SECRET || 'ATHGft4PI3TUNqZ7AWse1ivPEdhj6dYPy0nx60d/kr0=',
		refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret_key',
		accessTokenExpiry: '15m',
		refreshTokenExpiry: '7d',
	},

	email: {
		user: process.env.EMAIL_USER,
		password: process.env.EMAIL_APP_PASSWORD,
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
	},

	api: {
		openai: process.env.OPENAI_API_KEY,
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID,
		},
	},

	cors: {
		origin: process.env.FRONTEND_URL || 'http://localhost:5173',
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
	},

	collector: {
		currencies: ['BTC', 'ETH'],
		intervalMs: 60000,
		deribitApiUrl: 'https://www.deribit.com/api/v2',
	},

	// Sequelize CLI конфигурация
	development: {
		username: process.env.PG_USER || 'admin',
		password: process.env.PG_PASSWORD || 'admin123',
		database: process.env.PG_DATABASE || 'deribit_trades',
		host: process.env.PG_HOST || 'localhost',
		port: parseInt(process.env.PG_PORT) || 5432,
		dialect: 'postgres',
		logging: console.log,
		pool: {
			max: 5,
			min: 0,
			acquire: 30000,
			idle: 10000,
		},
	},
	test: {
		username: process.env.PG_USER || 'admin',
		password: process.env.PG_PASSWORD || 'admin123',
		database: process.env.PG_DATABASE_TEST || 'deribit_trades_test',
		host: process.env.PG_HOST || 'localhost',
		port: parseInt(process.env.PG_PORT) || 5432,
		dialect: 'postgres',
		logging: false,
	},
	production: {
		username: process.env.PG_USER,
		password: process.env.PG_PASSWORD,
		database: process.env.PG_DATABASE,
		host: process.env.PG_HOST,
		port: parseInt(process.env.PG_PORT) || 5432,
		dialect: 'postgres',
		logging: false,
		ssl: process.env.NODE_ENV === 'production',
		pool: {
			max: 10,
			min: 0,
			acquire: 30000,
			idle: 10000,
		},
	},
};

const requiredEnvVars = ['PG_USER', 'PG_PASSWORD', 'PG_HOST', 'PG_DATABASE', 'PG_PORT', 'JWT_SECRET'];

const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
	console.error('Missing required environment variables:', missingVars);
	process.exit(1);
}

module.exports = config;
