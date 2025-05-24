import debug from "debug";
import mongoose from "mongoose";

const databaseLog = debug("Mongoose");

mongoose.connection
	.on("connecting", () => databaseLog("MongoDB connecting ..."))
	.on("close", () => {
		databaseLog("Closes the connection.");
		process.exit(1);
	});

mongoose.connect(process.env.DATABASE_STRING ?? "").catch((err: Error) => {
	databaseLog("Database connecting error");
	databaseLog(err);
	mongoose.connection.close();
});

export { mongoose };
