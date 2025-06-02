import debug from "debug";
import { mongoose } from "./config/database.js";

import { app } from "./app.js";

import { checkEnv } from "./utils/checkEnv.js";

const serverLog = debug("Server");
const serverError = debug("ServerError");

interface ServeError extends Error {
	code?: string;
}

mongoose.connection
	.on("connected", () => {
		const missingEnv = checkEnv();
		if (!!missingEnv.length) {
			serverError(
				"The certain requirements of the environment of the application were not met."
			);
			for (let env of missingEnv) {
				serverError(`The ${env} of environment is missing.`);
			}

			mongoose.disconnect();
		} else {
			serverLog(`Server listening...`);
			app.listen(process.env.PORT, err => {
				err
					? (error: ServeError) => {
							serverLog(`Server listening error.`);
							switch (error.code) {
								case "EACCES":
									serverLog(
										`Port ${process.env.PORT} requires elevated privileges`
									);
									break;
								case "EADDRINUSE":
									serverLog(
										`Port ${process.env.PORT} is already in use`
									);
									break;
								default:
									serverLog(error);
							}
					  }
					: serverLog(`Server is listened`);
			});
		}
	})
	.on("disconnected", () => {
		process.on("exit", code => {
			throw Error(`About to exit with code: ${code}`);
		});
		process.exit(1);
	});
