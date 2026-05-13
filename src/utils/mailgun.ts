import Mailgun from 'mailgun.js';

export const mailgun = new Mailgun(FormData).client({
	username: 'api',
	key: process.env.MAILGUN_API_KEY,
});
