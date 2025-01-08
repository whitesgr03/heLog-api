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
		const currentTime = new Date();

		const newComment = new Comment({
			...req.data,
			author: req.user.id,
			lastModified: currentTime,
			createdAt: currentTime,
		});

		await newComment.save();

		res.json({
			success: true,
			message: "Create comment successfully.",
		});
	}),
];

export const commentUpdate = [
	verifyToken,
	verifyId("comment"),
	verifyPermission("comment"),
	verifyJSONSchema({
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
	asyncHandler(async (req, res, next) => {
		req.comment.content = req.data.content;
		req.comment.lastModified = new Date();

		await req.comment.save();

		res.json({
			success: true,
			message: "Update comment successfully.",
		});
	}),
];

export const commentDelete = [
	verifyToken,
	verifyId("comment"),
	verifyPermission("comment"),
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
