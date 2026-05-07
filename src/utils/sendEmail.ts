import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
	username: 'api',
	key: process.env.MAILGUN_API_KEY,
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
		from: `Helog <no-reply@${process.env.MAILGUN_DOMAIN}>`,
		to,
		subject,
		html,
	};

	await mg.messages.create(process.env.MAILGUN_DOMAIN, msg).catch(err => {
		throw Error(err);
	});
};
