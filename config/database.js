import debug from "debug";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";

const databaseLog = debug("Mongoose");

const handleError = err => {
	databaseLog("Database connecting error");
	databaseLog(err);
	mongoose.disconnect();
	databaseLog(`Database is disconnected.`);
	process.exit(1);
};

mongoose.connection.on("connecting", () =>
	databaseLog("Connecting MongoDB...")
);
mongoose
	.connect(process.env.DATABASE_STRING, { dbName: process.env.DATABASE_NAME })
	.catch(err => handleError(err));

export const sessionStore = MongoStore.create(mongoose.connection);
