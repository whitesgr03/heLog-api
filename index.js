import debug from "debug";
import mongoose from "mongoose";

import { app } from "./app.js";

const databaseLog = debug("Mongoose");
const serverLog = debug("Server");

const port = process.env.PORT || "3000";

const handleServer = () => {
	serverLog(`Server listening...`);
	const handleError = error => {
		serverLog(`Server listening error.`);
		switch (error.code) {
			case "EACCES":
				serverLog(`Port ${port} requires elevated privileges`);
				break;
			case "EADDRINUSE":
				serverLog(`Port ${port} is already in use`);
				break;
			default:
				serverLog(error);
		}
	};

	app.listen(port, serverLog(`Server is listened`)).on("error", handleError);
};

mongoose.connection.on("connected", () => {
	databaseLog("MongoDB is connected");
	handleServer();
});
