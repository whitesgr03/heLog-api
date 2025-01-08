// Modules
import asyncHandler from "express-async-handler";
import { isValidObjectId } from "mongoose";
import { checkSchema } from "express-validator";

// Middlewares
import { validationScheme } from "../middlewares/validationScheme.js";

// Models
import { Post } from "../models/post.js";
import { Comment } from "../models/comment.js";

export const commentList = [
	asyncHandler(async (req, res) => {
		const { postId } = req.params;
		const { skip = 0 } = req.query;

		const comments = !isValidObjectId(postId)
			? []
			: await Comment.find({
					post: postId,
			  })
					.populate("author", {
						username: 1,
						_id: 0,
					})
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(10)
					.exec();

		res.json({
			success: true,
			message: "Get all comments successfully.",
			data: comments,
		});
	}),
];

export const commentCreate = [
	checkSchema({
		content: {
			trim: true,
			notEmpty: {
				errorMessage: "The content is required.",
				bail: true,
			},
			isLength: {
				options: { max: 500 },
				errorMessage: "The content must be less than 500 long.",
			},
		},
	}),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { postId } = req.params;

		const post =
			isValidObjectId(postId) &&
			(await Post.findById({ _id: postId }).exec());

		post
			? next()
			: res.status(404).json({
					success: false,
					message: `Post could not be found.`,
			  });
	}),
	asyncHandler(async (req, res) => {
		const { postId } = req.params;

		const newComment = new Comment({
			author: req.user.id,
			post: postId,
			...req.data,
		});

		const comment = await newComment.save();

		res.json({
			success: true,
			message: "Create comment successfully.",
			data: await comment.populate("author", {
				username: 1,
				_id: 0,
			}),
		});
	}),
];

export const commentUpdate = [
	checkSchema({
		content: {
			trim: true,
			notEmpty: {
				errorMessage: "Content is required.",
				bail: true,
			},
			isLength: {
				options: { max: 500 },
				errorMessage: "Content must be less than 500 long.",
			},
		},
	}),
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
	asyncHandler(async (req, res, next) => {
		const { commentId } = req.params;

		const comment =
			isValidObjectId(commentId) &&
			(await Comment.findById(commentId).exec());

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
	asyncHandler(async (req, res) => {
		req.comment.content = req.data.content;

		const newComment = await req.comment.save();

		res.json({
			success: true,
			message: "Update comment successfully.",
			data: newComment,
		});
	}),
];

export const commentDelete = [
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
	asyncHandler(async (req, res, next) => {
		const { commentId } = req.params;

		const comment =
			isValidObjectId(commentId) &&
			(await Comment.findById(commentId).exec());

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
		req.comment.content = "Comment deleted by user";
		req.comment.lastModified = new Date();
		req.comment.deleted = true;

		await req.comment.save();

		res.json({
			success: true,
			message: "Delete comment successfully.",
		});
	}),
];
