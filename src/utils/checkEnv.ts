import { server } from './loggers.js';

export default function checkEnv(vars: readonly string[]) {
	server('checking environment variables...');
	try {
		vars.forEach(variable => {
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
}
