const databaseLog = require("debug")("Mongoose");
const mongoose = require("mongoose");

const dbString = process.env.DATABASE_STRING;
const dbName = process.env.DATABASE_NAME;

const handleError = err => {
	databaseLog(`${err.name}: ${err.message}`);
	process.exit(1);
};

const db = mongoose.connection;

db.on("connecting", () => databaseLog("Starting connect to MongoDB"));
db.on("error", err => handleError(err));

mongoose.connect(dbString, { dbName }).catch(error => handleError(error));

module.exports = db;
