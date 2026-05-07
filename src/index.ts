import mongoose from 'mongoose';
import { server } from './utils/loggers.js';
import './utils/checkEnv.js';
import { app } from './app.js';

const port = process.env.PORT || 4000;

mongoose.connection.on('connected', () => {
	app
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
});
