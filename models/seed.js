import mongoose from "mongoose";
import { faker } from "@faker-js/faker";

mongoose.connect(process.env.DATABASE_STRING, {
	dbName: process.env.DATABASE_NAME,
});

const Schema = mongoose.Schema;

const User = mongoose.model(
	"User",
	new Schema(
		{
			email: {
				type: String,
				required: true,
				immutable: true,
				lowercase: true,
			},
			password: {
				type: String,
			},
			username: { type: String },
			isAdmin: { type: Boolean, immutable: true },
			provider: { type: Array, required: true },
		},
		{ timestamps: true }
	)
);
const Post = mongoose.model(
	"Post",
	new Schema(
		{
			author: {
				type: Schema.Types.ObjectId,
				ref: "User",
				required: true,
				immutable: true,
			},
			title: { type: String },
			mainImage: { type: String },
			content: { type: String },
			publish: { type: Boolean, default: false },
		},
		{
			timestamps: true,
			virtuals: {
				mainImageUrl: {
					get() {
						const source = this.mainImage?.match(
							/(?<=img src=")(.*?)(?=")/g
						);
						return source ? source[0] : null;
					},
				},
			},
			toJSON: { virtuals: true },
		}
	)
);
const Comment = mongoose.model(
	"Comment",
	new Schema(
		{
			author: {
				type: Schema.Types.ObjectId,
				ref: "User",
				required: true,
				immutable: true,
			},
			post: {
				type: Schema.Types.ObjectId,
				ref: "Post",
				required: true,
				immutable: true,
			},
			parent: {
				type: Schema.Types.ObjectId,
				ref: "Comment",
				immutable: true,
			},
			reply: {
				type: Schema.Types.ObjectId,
				ref: "Comment",
				immutable: true,
			},
			content: { type: String, required: true },
			deleted: { type: Boolean, default: false },
		},
		{ timestamps: true }
	)
);

const randomInteger = (min, max) =>
	Math.floor(Math.random() * (max - min + 1) + min);

const clearAllCollection = async () => {
	console.log("Dropping collections.");
	await Comment.deleteMany();
	await Post.deleteMany();
	await User.deleteMany({ isAdmin: false });
};

const getUsers = async () => {
	return await User.find({}).exec();
};

const createUsers = async ({ amount }) => {
	console.log("Creating fake users.");

	const fakeUsers = [];
	const PROVIDER = ["google", "facebook"];

	for (let i = 0; i < amount; i++) {
		const obj = {
			email: faker.internet.email({ provider: "gmail.com" }),
			username: faker.person.fullName(),
			isAdmin: false,
			provider: PROVIDER[randomInteger(0, PROVIDER.length - 1)],
		};
		fakeUsers.push(obj);
	}

	return await User.insertMany(fakeUsers);
};

const createPosts = async ({ users, amount }) => {
	console.log("Creating fake posts.");

	const fakePosts = [];

	const IMAGE_SIZES = [
		{ width: 1920, height: 1080 },
		{ width: 1280, height: 720 },
		{ width: 1200, height: 630 },
		{ width: 250, height: 250 },
	];

	const createParagraph = ({ line, IMAGE_SIZES }) => {
		let content = "";

		for (let i = 0; i < line; i++) {
			const size = IMAGE_SIZES[randomInteger(0, IMAGE_SIZES.length - 1)];

			content += `<p>${faker.lorem.paragraphs({
				min: 3,
				max: 8,
			})}</p>\n`;

			i + 1 !== line &&
				!randomInteger(0, 2) &&
				(content += `<img style="width:${size.width}px; height:${
					size.height
				}px;" src="${faker.image.url({
					width: size.width,
					height: size.height,
				})}" alt="" width=${size.width} height=${size.height}>`);
		}

		return content;
	};

	for (let i = 0; i < amount; i++) {
		const obj = {
			author: users[randomInteger(0, users.length - 1)]._id,
			title: faker.lorem.words({ min: 5, max: 8 }),
			mainImage: `<p><img src="${faker.image.urlPicsumPhotos({
				width: 1920,
				height: 1080,
			})}" alt=""></p>`,
			content: createParagraph({ line: 5, IMAGE_SIZES }),
			publish: true,
		};
		fakePosts.push(obj);
	}

	return await Post.insertMany(fakePosts);
};

const createComments = async ({ users, posts, amount }) => {
	console.log("Creating fake comments.");

	const fakeComments = [];

	for (let i = 0; i < amount; i++) {
		const obj = {
			author: users[randomInteger(0, users.length - 1)].id,
			post: posts[randomInteger(0, posts.length - 1)]._id,
			content: `${faker.lorem.paragraphs({ min: 1, max: 5 }, "\n\n")}`,
			deleted: false,
		};
		fakeComments.push(obj);
	}

	return await Comment.insertMany(fakeComments);
};

const createCommentReplies = async ({ users, comments, amount }) => {
	// console.log("Creating fake comment replies.");

	const fakeCommentReplies = [];

	for (let i = 0; i < amount; i++) {
		const comment = comments[randomInteger(0, comments.length - 1)];
		const obj = {
			author: users[randomInteger(0, users.length - 1)].id,
			post: comment.post,
			parent: comment.id,
			content: `${faker.lorem.paragraphs({ min: 1, max: 5 }, "\n\n")}`,
			deleted: false,
		};
		fakeCommentReplies.push(obj);
	}

	return await Comment.insertMany(fakeCommentReplies);
};

const createReplies = async ({ users, commentReplies, amount }) => {
	// console.log("Creating fake replies.");

	const fakeReplies = [];

	for (let i = 0; i < amount; i++) {
		const commentReply =
			commentReplies[randomInteger(0, commentReplies.length - 1)];

		const obj = {
			author: users[randomInteger(0, users.length - 1)].id,
			post: commentReply.post,
			parent: commentReply.parent,
			reply: commentReply.id,
			content: `${faker.lorem.paragraphs({ min: 1, max: 2 }, "\n\n")}`,
			deleted: false,
		};
		fakeReplies.push(obj);
	}

	return await Comment.insertMany(fakeReplies);
};

const randomCreateReplies = async ({ users, comments, amount }) => {
	console.log("Creating fake comment replies and replies.");
	let newCommentReplies = [];
	let newReplies = [];

	for (let i = 0; i < amount; i++) {
		const countCommentReplies = newCommentReplies.length;
		const countReplies = newReplies.length;

		const [commentRepliesArray, repliesArray] = await Promise.all([
			createCommentReplies({
				users,
				comments,
				amount: randomInteger(
					countCommentReplies > countReplies ? 0 : 5,
					10
				),
			}),
			i !== 0 &&
				createReplies({
					users,
					commentReplies: newCommentReplies,
					amount: randomInteger(
						0,
						countCommentReplies > countReplies ? 10 : 5
					),
				}),
		]);

		newCommentReplies = newCommentReplies.concat(commentRepliesArray);
		i !== 0 && (newReplies = newReplies.concat(repliesArray));
	}

	return [newCommentReplies, newReplies];
};

const seed = async () => {
	console.log("Starting seeds.");

	await clearAllCollection();

	const users = [
		...(await getUsers()),
		...(await createUsers({ amount: 30 })),
	];

	const posts = await createPosts({
		users,
		amount: 100,
	});

	console.log("Amount of Fake Posts", posts.length);

	const comments = await createComments({
		users,
		posts,
		amount: 200,
	});

	console.log("Amount of Fake Comments", comments.length);

	// const commentReplies = await createCommentReplies({
	// 	users,
	// 	comments,
	// 	amount: 10,
	// });

	// console.log("Amount of Fake Comment Replies", commentReplies.length);

	// const replies = await createReplies({
	// 	users,
	// 	commentReplies,
	// 	amount: 10,
	// });

	// console.log("Amount of Fake Replies", replies.length);

	const [commentReplies, replies] = await randomCreateReplies({
		users,
		comments,
		amount: 100,
	});

	console.log("Amount of Fake Comment Replies", commentReplies.length);
	console.log("Amount of Fake Replies", replies.length);
};

await seed();

mongoose.disconnect();
