import { randomBytes, createHmac } from 'node:crypto';

export const generateCSRFToken = (sessionId: string) => {
	const secret =
		process.env.CSRF_SECRETS ??
		(() => {
			throw Error('An environment of CSRF_SECRETS is required');
		})();
	const randomValue = randomBytes(64).toString('hex');
	const message = `${sessionId.length}!${sessionId}!${randomValue.length}!${randomValue}`;
	const hmac = createHmac('sha256', secret).update(message).digest('hex');

	return hmac + '.' + randomValue;
};
