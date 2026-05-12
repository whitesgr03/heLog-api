import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';

import { User } from '../models/user.js';
import { Post } from '../models/post.js';
import { Comment } from '../models/comment.js';

import { UserDocument } from '../models/user.js';
import { PostDocument } from '../models/post.js';
import { CommentDocument } from '../models/comment.js';

interface ImageSize {
	width: number;
	height: number;
}

const randomInteger = (min: number, max: number) =>
	Math.floor(Math.random() * (max - min + 1) + min);

export const clearAllCollections = async () => {
	await Promise.all(
		Object.values(mongoose.connection.collections).map(
			async collection => await collection.deleteMany({}),
		),
	);
};

export const createFakeUsers = async ({
	amount,
}: {
	amount: number;
}): Promise<UserDocument[]> => {
	const fakeUsers = [] as UserDocument[];

	for (let i = 0; i < amount; i++) {
		const newUser = new User({
			username: faker.person.middleName(),
			email: faker.internet.email().toLocaleLowerCase(),
			isAdmin: false,
		});

		fakeUsers.push(newUser);
	}

	return await User.insertMany(fakeUsers);
};

export const createPosts = async ({
	users,
	amount,
}: {
	users: UserDocument[];
	amount: number;
}): Promise<PostDocument[]> => {
	const fakePosts = [] as PostDocument[];

	const IMAGE_SIZES: ImageSize[] = [
		{ width: 600, height: 400 },
		{ width: 300, height: 250 },
	];

	const createParagraph = ({
		line,
		IMAGE_SIZES,
	}: {
		line: number;
		IMAGE_SIZES: ImageSize[];
	}) => {
		let content = '';

		for (let i = 0; i < line; i++) {
			const size = IMAGE_SIZES[randomInteger(0, IMAGE_SIZES.length - 1)];

			content += `<p>${faker.lorem.paragraphs({
				min: 3,
				max: 5,
			})}</p>\n`;

			i + 1 !== line &&
				!randomInteger(0, 2) &&
				(content += `<p><img style="width:${
					size.width
				}px;" src="${faker.image.urlPicsumPhotos({
					width: size.width,
					height: size.height,
				})}" alt="" width=${size.width} height=${size.height}></p>`);
		}

		return content;
	};

	for (let i = 0; i < amount; i++) {
		const newPost = new Post({
			author: users[randomInteger(0, users.length - 1)].id,
			title: faker.book.title(),
			mainImage: faker.image.urlPicsumPhotos({
				width: 1920,
				height: 1080,
			}),
			content: createParagraph({ line: 5, IMAGE_SIZES }),
			publish: true,
		});
		fakePosts.push(newPost);
	}

	return await Post.insertMany(fakePosts);
};

export const createComments = async ({
	users,
	posts,
	amount,
}: {
	users: UserDocument[];
	posts: PostDocument[];
	amount: number;
}): Promise<CommentDocument[]> => {
	const fakeComments = [] as CommentDocument[];

	for (let i = 0; i < amount; i++) {
		const newReply = new Comment({
			author: users[randomInteger(0, users.length - 1)].id,
			post: posts[randomInteger(0, posts.length - 1)].id,
			content: `${faker.lorem.paragraphs({ min: 1, max: 2 }, '\n\n')}`,
			deleted: false,
		});
		fakeComments.push(newReply);
	}

	return await Comment.insertMany(fakeComments);
};

export const createCommentReplies = async ({
	users,
	comments,
	amount,
}: {
	users: UserDocument[];
	comments: CommentDocument[];
	amount: number;
}): Promise<CommentDocument[]> => {
	const fakeCommentReplies = [] as CommentDocument[];

	for (let i = 0; i < amount; i++) {
		const comment = comments[randomInteger(0, comments.length - 1)];

		const newReply = new Comment({
			author: users[randomInteger(0, users.length - 1)].id,
			post: comment.post,
			parent: comment.id,
			content: `${faker.lorem.paragraphs({ min: 1, max: 2 }, '\n\n')}`,
			deleted: false,
		});

		comment.child.push(newReply._id);
		await comment.save();

		fakeCommentReplies.push(newReply);
	}

	return await Comment.insertMany(fakeCommentReplies);
};

export const createReplies = async ({
	users,
	commentReplies,
	amount,
}: {
	users: UserDocument[];
	commentReplies: CommentDocument[];
	amount: number;
}): Promise<CommentDocument[]> => {
	const fakeReplies = [] as CommentDocument[];

	for (let i = 0; i < amount; i++) {
		const commentReply =
			commentReplies[randomInteger(0, commentReplies.length - 1)];

		const newReply = new Comment({
			author: users[randomInteger(0, users.length - 1)].id,
			post: commentReply.post,
			parent: commentReply.parent,
			reply: commentReply.id,
			content: `${faker.lorem.paragraphs({ min: 1, max: 2 }, '\n\n')}`,
			deleted: false,
		});

		const comment = await Comment.findById(commentReply.parent).exec();
		comment?.child.push(newReply._id);
		await comment?.save();
		fakeReplies.push(newReply);
	}

	return await Comment.insertMany(fakeReplies);
};

export const randomCreateReplies = async ({
	users,
	comments,
	amount,
}: {
	users: UserDocument[];
	comments: CommentDocument[];
	amount: number;
}) => {
	let newCommentReplies = [] as CommentDocument[];
	let newReplies = [] as CommentDocument[];

	for (let i = 0; i < amount; i++) {
		const countCommentReplies = newCommentReplies.length;
		const countReplies = newReplies.length;

		const [commentRepliesArray, repliesArray] = await Promise.all([
			createCommentReplies({
				users,
				comments,
				amount: randomInteger(countCommentReplies > countReplies ? 0 : 5, 10),
			}),
			i !== 0 &&
				createReplies({
					users,
					commentReplies: newCommentReplies,
					amount: randomInteger(0, countCommentReplies > countReplies ? 10 : 5),
				}),
		]);

		newCommentReplies = newCommentReplies.concat(commentRepliesArray);
		repliesArray && (newReplies = newReplies.concat(repliesArray));
	}

	return [newCommentReplies, newReplies];
};
