import mongoose from 'mongoose';
import { database } from '../utils/loggers.js';
import checkEnv from '../utils/checkEnv.js';
import connectDB from '../config/database.js';

import {
	clearAllCollections,
	createFakeUsers,
	createPosts,
	createComments,
	randomCreateReplies,
} from './methods.js';

const seed = async () => {
	checkEnv(['DATABASE_STRING']);
	await connectDB();

	database('Starting seeds');

	database('Removing collections');
	await clearAllCollections();

	database('Creating fake users');
	const users = await createFakeUsers({ amount: 10 });

	database('Creating fake posts');
	const posts = await createPosts({ users, amount: 100 });
	database(`${posts.length} of fake posts have been created`);

	database('Creating fake comments');
	const comments = await createComments({
		users,
		posts,
		amount: 200,
	});
	database(`${comments.length} of fake comments have been created`);

	database('Creating fake comment replies and replies');
	const [commentReplies, replies] = await randomCreateReplies({
		users,
		comments,
		amount: 100,
	});
	database(
		`${commentReplies.length} of fake comment replies have been created`,
	);
	database(`${replies.length} of fake replies have been created`);

	mongoose.disconnect();
};

await seed();
