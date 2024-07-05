import debug from "debug";
import mongoose from "mongoose";

const databaseLog = debug("Mongoose");

const handleError = err => {
	databaseLog(`${err.name}: ${err.message}`);
	process.exit(1);
};

const db = mongoose.connection;

db.on("connecting", () => databaseLog("Starting connect to MongoDB"));
db.on("disconnected", () => databaseLog("Disconnected to MongoDB"));
db.on("error", err => handleError(err));

mongoose
	.connect(process.env.DATABASE_STRING, { dbName: process.env.DATABASE_NAME })
	.catch(err => handleError(err));

export default db;
