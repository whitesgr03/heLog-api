import debug from "debug";
import { mongoose } from "./config/database.js";

import { app } from "./app.js";

import { checkEnv } from "./config/envConfig.js";

const databaseLog = debug("Mongoose");
const serverLog = debug("Server");
const serverError = debug("ServerError");

interface ServeError extends Error {
	code?: string;
}

const missingEnv = checkEnv();

if (!!missingEnv.length) {
	serverError(
		"The certain requirements of the environment of the application were not met."
	);
	for (let env of missingEnv) {
		serverError(`The ${env} of environment is missing.`);
	}
	mongoose.connection.close();
	process.on("exit", code => {
		throw Error(`About to exit with code: ${code}`);
	});
} else {
	mongoose.connection.on("connected", () => {
		databaseLog("MongoDB is connected");
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
	});
}
