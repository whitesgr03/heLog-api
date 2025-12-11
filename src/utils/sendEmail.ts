import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
	username: 'api',
	key: process.env.MAINGUN_API_KEY as string,
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
		from: `Helog <no-reply@${process.env.MAINGUN_DOMAIN}>`,
		to,
		subject,
		html,
	};

	await mg.messages.create(process.env.MAINGUN_DOMAIN as string, msg);
};
