import { RequestHandler } from 'express';

export const authenticate: RequestHandler = (req, res, next) => {
	req.isAuthenticated()
		? next()
		: res.status(401).json({
				success: false,
				message: 'Missing authentication token.',
			});
};

export const isLogin: RequestHandler = (req, res, next) => {
	req.isAuthenticated() ? res.redirect(process.env.HELOG_URL!) : next();
};
