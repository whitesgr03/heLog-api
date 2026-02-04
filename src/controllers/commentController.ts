// Modules
import asyncHandler from 'express-async-handler';
import { isValidObjectId, Types } from 'mongoose';
import { body } from 'express-validator';

// Middlewares
import { validationScheme } from '../middlewares/validationScheme.js';

// Models
import { User } from '../models/user.js';
import { Post } from '../models/post.js';
import { Comment } from '../models/comment.js';

export const commentList = [
	asyncHandler(async (req, res) => {
		const { postId } = req.params;
		const { skip = 0 } = req.query;

		const result =
			isValidObjectId(postId) &&
			(await Promise.all([
				Comment.find(
					{ post: new Types.ObjectId(`${postId}`), parent: null },
					{},
					{
						skip: Number(skip),
						limit: 100,
						sort: {
							createdAt: -1,
							_id: -1,
						},
						populate: {
							path: 'author',
							select: {
								_id: 0,
								username: 1,
							},
						},
					},
				).exec(),
				Comment.countDocuments({
					post: new Types.ObjectId(`${postId}`),
					parent: null,
				}),
				Comment.countDocuments({
					post: new Types.ObjectId(`${postId}`),
				}),
			]));

		const comments = !result
			? []
			: {
					comments: result[0],
					commentsCount: result[1],
					commentAndReplyCounts: result[2],
				};

		res.json({
			success: true,
			message: 'Get all comments successfully.',
			data: comments,
		});
	}),
];

export const commentCreate = [
	body('content')
		.trim()
		.notEmpty()
		.withMessage('The content is required.')
		.bail()
		.isLength({ max: 500 })
		.withMessage('The content must be less than 500 long.'),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { postId } = req.params;

		const post =
			isValidObjectId(postId) && (await Post.findById(postId).exec());

		post
			? next()
			: res.status(404).json({
					success: false,
					message: `Post could not be found.`,
				});
	}),
	asyncHandler(async (req, res) => {
		const { postId } = req.params;

		await new Comment({
			author: req.user!.id,
			post: postId,
			...req.data,
		}).save();

		res.json({
			success: true,
			message: 'Create comment successfully.',
		});
	}),
];

export const commentUpdate = [
	body('content')
		.trim()
		.notEmpty()
		.withMessage('The content is required.')
		.bail()
		.isLength({ max: 500 })
		.withMessage('The content must be less than 500 long.'),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { commentId } = req.params;

		const comment =
			isValidObjectId(commentId) && (await Comment.findById(commentId).exec());

		const handleSetLocalVariable = () => {
			req.comment = comment;
			next();
		};

		comment
			? handleSetLocalVariable()
			: res.status(404).json({
					success: false,
					message: `Comment could not be found.`,
				});
	}),
	asyncHandler(async (req, res, next) => {
		const user =
			req.user && (await User.findById(req.user.id, { isAdmin: 1 }).exec());

		user?.isAdmin || user?.id.toString() === req.comment.author._id.toString()
			? next()
			: res.status(403).json({
					success: false,
					message: 'This request requires higher permissions.',
				});
	}),
	asyncHandler(async (req, res) => {
		req.comment.content = req.data.content;

		await req.comment.save();

		const updatedComment = await req.comment.populate('author', {
			_id: 0,
			username: 1,
		});

		res.json({
			success: true,
			message: 'Update comment successfully.',
			data: updatedComment,
		});
	}),
];

export const commentDelete = [
	asyncHandler(async (req, res, next) => {
		const { commentId } = req.params;

		const comment =
			isValidObjectId(commentId) && (await Comment.findById(commentId).exec());

		const handleSetLocalVariable = () => {
			req.comment = comment;
			next();
		};

		comment
			? handleSetLocalVariable()
			: res.status(404).json({
					success: false,
					message: `Comment could not be found.`,
				});
	}),
	asyncHandler(async (req, res, next) => {
		const user =
			req.user && (await User.findById(req.user.id, { isAdmin: 1 }).exec());

		const isCommentOwner =
			user?.id.toString() === req.comment.author._id.toString();

		const handleSetLocalVariable = () => {
			req.deletedByAdmin = user?.isAdmin && !isCommentOwner;
			next();
		};

		user?.isAdmin || isCommentOwner
			? handleSetLocalVariable()
			: res.status(403).json({
					success: false,
					message: 'This request requires higher permissions.',
				});
	}),
	asyncHandler(async (req, res) => {
		req.comment.content = req.deletedByAdmin
			? 'Comment deleted by admin'
			: 'Comment deleted by user';
		req.comment.deleted = true;

		await req.comment.save();

		const deletedComment = await req.comment.populate('author', {
			_id: 0,
			username: 1,
		});

		res.json({
			success: true,
			message: 'Delete comment successfully.',
			data: deletedComment,
		});
	}),
];
