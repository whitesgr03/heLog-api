import { server } from './loggers.js';

const ENV_VARS = [
	'DB',
	'SERVER',
	'FACEBOOK_CLIENT_ID',
	'FACEBOOK_CLIENT_SECRET',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
	'HELOG_API_URL',
	'HELOG_URL',
	'DATABASE_STRING',
	'DOMAIN',
	'CSRF_SECRETS',
	'MAILGUN_API_KEY',
	'MAILGUN_DOMAIN',
] as const;

try {
	ENV_VARS.forEach(variable => {
		if (!process.env[variable]) {
			throw Error(`environment variable ${variable} is missing.`);
		}
	});
} catch (error) {
	if (error instanceof Error) {
		server(`process exit because ${error.message}`);
		process.exit(1);
	}
}
