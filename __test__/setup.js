import { beforeEach, vi } from "vitest";
import { clearAllCollections, createUsers } from "../lib/seed";

beforeEach(async () => {
	vi.clearAllMocks();

	await clearAllCollections();
	await createUsers({ amount: 2 });
});
