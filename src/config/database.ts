import debug from "debug";
import mongoose from "mongoose";

const databaseLog = debug("Mongoose");

mongoose.connection.on("connecting", () =>
	databaseLog("MongoDB connecting ...")
);

mongoose.connect(process.env.DATABASE_STRING ?? "").catch((err: Error) => {
	databaseLog("Database connecting error");
	databaseLog(err);
	mongoose.connection.close();
});

export { mongoose };
