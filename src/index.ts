import mongoose from 'mongoose';
import { serverLog } from '../src/config/debug.js';
import { app } from './app.js';

const port = process.env.PORT || 4000;

mongoose.connection.on('connected', () => {
	app
		.listen(port, () => serverLog(`Server is listened`))
		.on('error', (error: { code?: string }) => {
			switch (error.code) {
				case 'EACCES':
					serverLog(`Port ${port} requires elevated privileges`);
					break;
				case 'EADDRINUSE':
					serverLog(`Port ${port} is already in use`);
					break;
				default:
					serverLog('process.exit', error);
					process.exit(1);
			}
		});
});
