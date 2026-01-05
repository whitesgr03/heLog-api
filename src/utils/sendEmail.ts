import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
	username: 'api',
	key: (process.env.NODE_ENV === 'production'
		? process.env.MAINGUN_API_KEY
		: process.env.MAINGUN_TEST_API_KEY) as string,
});

interface sendEmailType {
	receiver: string;
	subject: string;
	html: string;
}

export const sendEmail = async ({
	receiver: to,
	subject,
	html,
}: sendEmailType) => {
	const msg = {
		from: `Helog <no-reply@${
			process.env.NODE_ENV === 'production'
				? process.env.MAINGUN_DOMAIN
				: process.env.MAINGUN_TEST_DOMAIN
		}>`,
		to,
		subject,
		html,
	};

	await mg.messages.create(
		(process.env.NODE_ENV === 'production'
			? process.env.MAINGUN_DOMAIN
			: process.env.MAINGUN_TEST_DOMAIN) as string,
		msg,
	);
};
