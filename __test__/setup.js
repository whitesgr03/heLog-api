import { afterAll, beforeEach, beforeAll, vi } from "vitest";
import { mongoose } from "../config/database.js";
import { clearAllCollections, createUsers } from "../lib/seed";
import debug from "debug";

const databaseLog = debug("Mongoose");

beforeAll(async () => {
	databaseLog("MongoDB is connected.");
});

beforeEach(async () => {
	vi.clearAllMocks();
	await clearAllCollections();
	await createUsers({ amount: 2 });
});

afterAll(() => {
	mongoose.disconnect();
	databaseLog("MongoDB is disconnected.");
});
