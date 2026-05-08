import { server } from './utils/loggers.js';
import checkEnv from './utils/checkEnv.js';
import connectDB from './config/database.js';
import initialPassport from './config/passport.js';
import createApp from './app.js';

const port = process.env.PORT || 4000;

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
];

checkEnv(ENV_VARS);

await connectDB();

initialPassport();

createApp()
	.listen(port, () => server(`is listened.`))
	.on('error', error => {
		server(`has an error occur.`);
		if ('code' in error) {
			switch (error.code) {
				case 'EACCES':
					server(`port ${port} requires elevated privileges`);
					break;
				case 'EADDRINUSE':
					server(`port ${port} is already in use`);
					break;
				default:
					server(`process exit with error code: ${error.code}`);
					process.exit(1);
			}
		} else {
			if (error instanceof Error) server(`error message: ${error.message}`);
			server(`error detail: ${error}`);
		}
	});
