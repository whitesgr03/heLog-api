import { RateLimiterMongo } from 'rate-limiter-flexible';
import { mongoose } from '../config/database.js';

export const limiterBruteForceByIp = new RateLimiterMongo({
	keyPrefix: 'all_routes_rate_limit_by_ip',
	storeClient: mongoose.connection,
	points: 100,
	duration: 60 * 60,
	blockDuration: 8 * 60 * 60,
});

export const limiterLoginFailsByEmail = new RateLimiterMongo({
	keyPrefix: 'login_rate_limit_by_email',
	storeClient: mongoose.connection,
	points: 10,
	duration: 3 * 60 * 60,
	blockDuration: 3 * 60 * 60,
});

export const limiterRequestRegistrationByIp = new RateLimiterMongo({
	keyPrefix: 'request_register_rate_limit_by_ip',
	storeClient: mongoose.connection,
	points: 3,
	duration: 24 * 60 * 60,
	blockDuration: 24 * 60 * 60,
});

export const limiterVerifyCodeByEmail = new RateLimiterMongo({
	keyPrefix: 'verify_code_rate_limit_by_email',
	storeClient: mongoose.connection,
	points: 5,
	duration: 5 * 60,
	blockDuration: 10 * 60,
});

export const limiterRequestResettingPasswordByEmail = new RateLimiterMongo({
	keyPrefix: 'request_reset_password_rate_limit_by_email',
	storeClient: mongoose.connection,
	points: 10,
	duration: 3 * 60 * 60,
	blockDuration: 3 * 60 * 60,
});
