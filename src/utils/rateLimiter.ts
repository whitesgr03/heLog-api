import { RateLimiterMongo } from 'rate-limiter-flexible';
import mongoose from 'mongoose';

export const limiterBruteForceByIp = new RateLimiterMongo({
	keyPrefix: 'all_routes_rate_limit_by_ip',
	storeClient: mongoose.connection,
	points: 100,
	duration: process.env.NODE_ENV === 'production' ? 8 * 60 * 60 : 1,
	blockDuration: process.env.NODE_ENV === 'production' ? 8 * 60 * 60 : 0,
});

export const limiterLoginFailsByEmail = new RateLimiterMongo({
	keyPrefix: 'login_rate_limit_by_email',
	storeClient: mongoose.connection,
	points: 5,
	duration: process.env.NODE_ENV === 'production' ? 60 * 60 : 1,
	blockDuration: process.env.NODE_ENV === 'production' ? 60 * 60 : 0,
});

export const limiterRequestRegistrationByIp = new RateLimiterMongo({
	keyPrefix: 'request_register_rate_limit_by_ip',
	storeClient: mongoose.connection,
	points: 3,
	duration: process.env.NODE_ENV === 'production' ? 24 * 60 * 60 : 1,
	blockDuration: process.env.NODE_ENV === 'production' ? 24 * 60 * 60 : 0,
});

export const limiterVerifyCodeByEmail = new RateLimiterMongo({
	keyPrefix: 'verify_code_rate_limit_by_email',
	storeClient: mongoose.connection,
	points: 3,
	duration: 0,
});

export const limiterRequestResettingPasswordByEmail = new RateLimiterMongo({
	keyPrefix: 'request_reset_password_rate_limit_by_email',
	storeClient: mongoose.connection,
	points: 3,
	duration: process.env.NODE_ENV === 'production' ? 60 * 60 : 1,
	blockDuration: process.env.NODE_ENV === 'production' ? 60 * 60 : 0,
});
