import os from "node:os";
import debug from "debug";

import app from "./app.js";
import db from "./config/database.js";

const databaseLog = debug("Mongoose");
const serverLog = debug("Server");

const port = process.env.PORT || "3000";

const handleListening = async () => {
	const handlePrintNetwork = () => {
		const IP_Address = os
			.networkInterfaces()
			.en0.find(internet => internet.family === "IPv4").address;
		serverLog(`Listening on Your Network:  http://${IP_Address}:${port}`);
	};

	serverLog(`Listening on Local:         http://localhost:${port}`);
	handlePrintNetwork();
};

const handleError = error => {
	switch (error.code) {
		case "EACCES":
			serverLog(`Port ${port} requires elevated privileges`);
			process.exit(1);
		case "EADDRINUSE":
			serverLog(`Port ${port} is already in use`);
			process.exit(1);
		default:
			throw error;
	}
};

db.on("connected", () => {
	databaseLog("Connecting successfully");
	app.listen(
		port,
		process.env.NODE_ENV === "development" ? handleListening : {}
	).on("error", handleError);
});
