// Modules
import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';
import { isValidObjectId } from 'mongoose';

// Middlewares
import { validationScheme } from '../middlewares/validationScheme.js';

// Models
import { User } from '../models/user.js';
import { Federated } from '../models/federated.js';
import { Post } from '../models/post.js';
import { Comment } from '../models/comment.js';

export const userPostList = [
	asyncHandler(async (req, res) => {
		const { skip = 0 } = req.query;
		const { id } = req.user as Express.User;

		const [userPosts, userPostsCount] = await Promise.all([
			Post.find(
				{ author: id },
				{ author: 0, mainImage: 0, content: 0 },
				{
					skip: Number(skip),
					limit: 100,
					sort: {
						createdAt: -1,
						_id: -1,
					},
				},
			).exec(),
			Post.countDocuments({ author: id }),
		]);

		res.json({
			success: true,
			message: "Get user's post list successfully.",
			data: { userPosts, userPostsCount },
		});
	}),
];
export const userPostDetail = [
	asyncHandler(async (req, res) => {
		const { postId } = req.params;
		const { id } = req.user as Express.User;

		const post =
			typeof postId === 'string' &&
			isValidObjectId(postId) &&
			(await Post.findOne(
				{
					_id: postId,
					author: id,
				},
				{
					author: 0,
				},
			).exec());

		if (post) {
			res.json({
				success: true,
				message: 'Get post successfully.',
				data: post,
			});
			return;
		}
		res.status(404).json({
			success: false,
			message: `Post could not be found.`,
		});
	}),
];
export const userDetail = [
	asyncHandler(async (req, res) => {
		const { id } = req.user as Express.User;

		const user = await User.findById(id, {
			username: 1,
			isAdmin: 1,
		}).exec();

		res.set('Cache-Control', 'no-store, max-age=0').json({
			success: true,
			message: 'Get user info successfully.',
			data: user,
		});
	}),
];
export const userUpdate = [
	body('username')
		.trim()
		.notEmpty()
		.withMessage('Username is required.')
		.bail()
		.isLength({ max: 30 })
		.withMessage('username must be less than 30 long.')
		.bail()
		.custom(username => username.match(/^([a-zA-Z0-9](-|_|\s)?)*[a-zA-Z0-9]$/))
		.withMessage('Username must be alphanumeric.'),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { username } = req.data;
		const { id } = req.user as Express.User;

		const existingUserName = await User.findOne({
			$and: [
				{ username },
				{
					_id: {
						$ne: id,
					},
				},
			],
		}).exec();

		if (!existingUserName) {
			return next();
		}

		res.status(409).json({
			success: false,
			fields: {
				username: 'Username is been used.',
			},
		});
	}),
	asyncHandler(async (req, res) => {
		const { id } = req.user as Express.User;

		const user = await User.findByIdAndUpdate(
			id,
			{ ...req.data },
			{
				returnDocument: 'after',
				select: {
					username: 1,
					isAdmin: 1,
				},
			},
		).exec();

		res.set('Cache-Control', 'no-store, max-age=0').json({
			success: true,
			message: 'Update user successfully.',
			data: user,
		});
	}),
];
export const userDelete = [
	asyncHandler(async (req, res, next) => {
		const { id } = req.user as Express.User;

		const posts = await Post.find({ author: id }, { _id: 1 }).exec();

		await Promise.all([
			...posts.map(async post => {
				Promise.all([
					Comment.deleteMany({ post: post._id }).exec(),
					post.deleteOne(),
				]);
			}),
			Comment.updateMany(
				{
					author: id,
				},
				{
					content: 'Comment deleted by user',
					deleted: true,
				},
			).exec(),
			Federated.deleteOne({ user: id }).exec(),
			User.findByIdAndDelete(id).exec(),
		]);

		req.logout(logoutError => {
			if (logoutError) return next(logoutError);
			req.session.destroy(error => {
				if (error) {
					next(error);
				} else {
					res
						.clearCookie(
							process.env.NODE_ENV === 'production'
								? '__Secure-token'
								: 'token',
							{ domain: process.env.DOMAIN ?? '' },
						)
						.clearCookie(
							process.env.NODE_ENV === 'production' ? '__Secure-id' : 'id',
							{ domain: process.env.DOMAIN ?? '' },
						)
						.set('Clear-Site-Data', '"cookies"')
						.json({
							success: true,
							message: 'Delete user successfully.',
						});
				}
			});
		});
	}),
];
