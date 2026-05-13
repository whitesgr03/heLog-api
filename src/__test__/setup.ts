import { afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import initialPassport from '../config/passport';
import { clearAllCollections } from '../seed/methods.js';

const mongoServer = await MongoMemoryServer.create();
mongoose.connect(mongoServer.getUri());

initialPassport();

afterEach(async () => {
	await clearAllCollections();
});

afterAll(async () => {
	await mongoServer.stop();
});
