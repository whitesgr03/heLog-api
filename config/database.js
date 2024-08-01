import debug from "debug";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";

const databaseLog = debug("Mongoose");

const handleError = err => {
	databaseLog("Connect error");
	databaseLog(`${err.name}: ${err.message}`);
	databaseLog("Process exit.");
	process.exit(1);
};

const db = mongoose.connection;

db.on("connecting", () => databaseLog("Starting connect to MongoDB"));
db.on("disconnected", () => databaseLog("Disconnected to MongoDB"));
db.on("error", err => handleError(err));

mongoose
	.connect(process.env.DATABASE_STRING, { dbName: process.env.DATABASE_NAME })
	.catch(err => handleError(err));

const sessionStore = MongoStore.create(db);

export { db as default, sessionStore };
