import { afterAll, beforeEach, vi } from 'vitest';
import { mongoose } from '../config/database.js';
import { clearAllCollections, createFakeUsers } from '../lib/seed.js';

beforeEach(async () => {
	vi.clearAllMocks();
	await clearAllCollections({ forTesting: true });
	await createFakeUsers({ amount: 2, forTesting: true });
});

afterAll(() => {
	mongoose.disconnect();
});
