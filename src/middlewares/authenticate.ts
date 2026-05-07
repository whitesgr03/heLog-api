import { RequestHandler } from 'express';

export const authenticate: RequestHandler = (req, res, next) => {
	if (req.isAuthenticated()) return next();

	res.status(401).json({
		success: false,
		message: 'Missing authentication token.',
	});
};

export const isLogin: RequestHandler = (req, res, next) => {
	if (!req.isAuthenticated()) return next();

	res.redirect(process.env.HELOG_URL);
};
