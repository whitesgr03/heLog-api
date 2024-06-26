import os from "node:os";
import debug from "debug";

import app from "./app.js";
import db from "./config/database.js";

const databaseLog = debug("Mongoose");
const serverLog = debug("Server");

const PORT = process.env.PORT || "3000";

const handleListening = async () => {
	const handlePrintNetwork = () => {
		const IP_Address = os
			.networkInterfaces()
			.en0.find(internet => internet.family === "IPv4").address;
		serverLog(`Listening on Your Network:  http://${IP_Address}:${PORT}`);
	};

	serverLog(`Listening on Local:         http://localhost:${PORT}`);
	process.env.NODE_ENV === "development" && handlePrintNetwork();
};

const handleError = error => {
	switch (error.code) {
		case "EACCES":
			serverLog(`Port ${PORT} requires elevated privileges`);
			process.exit(1);
		case "EADDRINUSE":
			serverLog(`Port ${PORT} is already in use`);
			process.exit(1);
		default:
			throw error;
	}
};

db.on("connected", () => {
	databaseLog("Connecting successfully");
	app.listen(PORT, handleListening).on("error", handleError);
});
