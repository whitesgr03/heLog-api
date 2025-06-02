import { afterAll, beforeEach, vi } from "vitest";
import { mongoose } from "../config/database.js";
import { clearAllCollections, createUsers } from "../lib/seed.js";

beforeEach(async () => {
	vi.clearAllMocks();
	await clearAllCollections({ forTesting: true });
	await createUsers({ amount: 2, forTesting: true });
});

afterAll(() => {
	mongoose.disconnect();
});
