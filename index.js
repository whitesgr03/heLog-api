const databaseLog = require("debug")("Mongoose");
const serverLog = require("debug")("Server");

const db = require("./config/database");
const os = require("node:os");
const app = require("./app");

const PORT = process.env.PORT || "3000";

const handleListening = async () => {
	const IP_Address =
		process.env.NODE_ENV === "development" &&
		os
			.networkInterfaces()
			.en0.find(interface => interface.family === "IPv4").address;

	serverLog(`Listening on Local:            http://localhost:${PORT}`);
	process.env.NODE_ENV === "development" &&
		serverLog(
			`Listening on On Your Network:  http://${IP_Address}:${PORT}`
		);
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
