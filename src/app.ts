import express, { ErrorRequestHandler, RequestHandler } from 'express';
import morgan from 'morgan';
import session, { SessionOptions } from 'express-session';
import cors from 'cors';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import passport from 'passport';
import helmet, { HelmetOptions } from 'helmet';
import { RateLimiterRes } from 'rate-limiter-flexible';
import { limiterBruteForceByIp } from './utils/rateLimiter.js';
import { server } from './utils/loggers.js';
import path from 'node:path';

// routes
import { accountRouter } from './routes/account.js';
import { blogRouter } from './routes/blog.js';
import { userRouter } from './routes/user.js';

const createApp = () => {
	const app = express();

	app.get('/favicon.ico', (_req, res) => {
		res.sendStatus(204);
	});

	app.use(async (req, res, next) => {
		try {
			if (process.env.NODE_ENV !== 'development') {
				await limiterBruteForceByIp.consume(req.ip as string);
			}
			next();
		} catch (rejected) {
			if (rejected instanceof RateLimiterRes) {
				res.status(429).json({
					success: false,
					message: 'Too many requests',
				});
			} else {
				next(rejected);
			}
		}
	});

	const corsOptions = {
		origin:
			process.env.NODE_ENV === 'production'
				? /helog\.whitesgr03\.com$/
				: /localhost/,
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		credentials: true,
		allowedHeaders: ['Content-Type', 'X-CSRF-TOKEN'],
		exposedHeaders: ['Retry-After', 'Expire-After'],
		maxAge: 10,
		preflightContinue: false,
		optionsSuccessStatus: 204,
	};
	const sessionOptions: SessionOptions = {
		secret: process.env.SESSION_SECRETS?.split(','),
		resave: false,
		saveUninitialized: false, // If the user first send request to the server, at the end of the request and when saveUninitialized is false, the req.session is unmodified then will not be stored in the session store.
		store: MongoStore.create({
			client: mongoose.connection.getClient(),
			stringify: false,
		}),
		name: process.env.NODE_ENV === 'production' ? '__Secure-id' : 'id',
		cookie: {
			sameSite: 'strict',
			domain: process.env.DOMAIN ?? '',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
		},
	};
	const helmetOptions: HelmetOptions = {
		xFrameOptions: { action: 'deny' }, // To avoid clickjacking attacks, by ensuring that their content is not embedded into other sites.
		strictTransportSecurity: {
			//  It should only be accessed using HTTPS, instead of using HTTP.
			maxAge: 63072000,
			preload: true,
		},
		crossOriginEmbedderPolicy: true, // A document can only load resources from the same origin.
		crossOriginResourcePolicy: { policy: 'same-site' }, // Limit current resource loading to the site and sub-domains only.
		xPoweredBy: false,
	};
	const staticOptions = {
		maxAge: '1d',
		index: false,
		redirect: false,
	};

	app.set('trust proxy', 1);
	app.disable('x-powered-by');

	app.use(cors(corsOptions));
	app.use(helmet(helmetOptions));
	app.use(session(sessionOptions));
	app.use(passport.session());
	app.use(morgan(process.env.NODE_ENV === 'production' ? 'common' : 'dev'));
	app.use(
		express.static(path.join(import.meta.dirname, 'public'), staticOptions),
	);
	app.use(express.json());

	// session touch
	app.use((req, _res, next) => {
		if (req.user) {
			const idleTimeout = 2 * 24 * 60 * 60 * 1000; // 48 hours

			const expires = req.session.cookie.expires?.getTime() ?? Date.now();

			req.session.cookie.maxAge =
				Date.now() + idleTimeout > expires ? expires - Date.now() : idleTimeout;
		}
		next();
	});

	app.get('/', (_req, res) => {
		res.redirect(process.env.HELOG_URL);
	});
	app.use('/account', accountRouter);
	app.use('/user', userRouter);
	app.use('/blog', blogRouter);

	// Unknown routes handler
	app.use(((_req, res) => {
		res.status(404).json({
			success: false,
			message: 'The endpoint you are looking for cannot be found.',
		});
	}) as RequestHandler);

	// Errors handler
	app.use(((err, _req, res, _next) => {
		server('has an error occur.');
		if (err instanceof Error) server(`error message: ${err.message}`);
		server(`error detail: ${err}`);

		res.status(500).json({
			success: false,
			message: 'The server encountered an unexpected condition.',
		});
	}) as ErrorRequestHandler);

	return app;
};

export default createApp;
