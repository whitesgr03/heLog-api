import { RequestHandler } from 'express';
import { createHmac } from 'node:crypto';

export const validationCSRF: RequestHandler = (req, res, next) => {
	const csrfToken = req.headers['x-csrf-token'];
	const [token = '', randomValue = ''] =
		typeof csrfToken === 'string' ? csrfToken.split('.') : [];

	const secret = process.env.CSRF_SECRETS!;

	const message = `${req.sessionID.length}!${req.sessionID}!${randomValue.length}!${randomValue}`;
	const hmac = createHmac('sha256', secret).update(message).digest('hex');

	hmac === token
		? next()
		: res.status(403).json({
				success: false,
				message: 'CSRF token mismatch.',
			});
};
