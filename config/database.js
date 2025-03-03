import debug from "debug";
import mongoose from "mongoose";

const databaseLog = debug("Mongoose");

const handleError = err => {
	databaseLog("Database connecting error");
	databaseLog(err);
	databaseLog(`Database is disconnected.`);
	mongoose.disconnect();
};

mongoose.connection.on("connecting", () =>
	databaseLog("MongoDB connecting ...")
);
mongoose.connect(process.env.DATABASE_STRING).catch(err => handleError(err));

export { mongoose };
