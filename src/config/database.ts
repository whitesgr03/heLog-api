import debug from "debug";
import mongoose from "mongoose";

const databaseLog = debug("Mongoose");

mongoose.connection
	.on("connecting", () => databaseLog("MongoDB connecting ..."))
	.on("connected", () => databaseLog("MongoDB is connected."))
	.on("disconnected", () => databaseLog("MongoDB is disconnected."))
	.on("error", err => {
		databaseLog("Database has some error occurs");
		databaseLog(err);
	});

mongoose.connect(process.env.DATABASE_STRING as string).catch((err: Error) => {
	databaseLog("Database connecting error");
	databaseLog(err);
	mongoose.disconnect();
});

export { mongoose };
