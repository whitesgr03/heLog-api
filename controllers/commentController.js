import asyncHandler from "express-async-handler";
import { isValidObjectId, Types } from "mongoose";

import verifyToken from "../middlewares/verifyToken.js";
import verifyScope from "../middlewares/verifyScope.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyId from "../middlewares/verifyId.js";

import Comment from "../models/comment.js";

const commentList = [
	asyncHandler((req, res, next) => {
		const { postId = null } = req.query;

		!postId || isValidObjectId(postId)
			? next()
			: res.status(400).json({
					success: false,
					message: "The postId query is invalid object ID.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const { limit = 0, postId = null } = req.query;

		const filter = {};

		postId && (filter.post = new Types.ObjectId(postId));

		const comments = await Comment.find(filter)
			.populate("author", {
				name: 1,
			})
			.sort({ createdAt: -1 })
			.limit(limit)
			.exec();

		res.header({
			"Cache-Control": "no-store",
		}).json({
			success: true,
			message: "Get all comments successfully.",
			data: comments,
		});
	}),
];
const commentCreate = [
	verifyToken,
	verifyId("post"),
	verifyScope("write_comment"),
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
			escape: true,
		},
	}),
	asyncHandler(async (req, res, next) => {
		const currentTime = new Date();

		const newComment = new Comment({
			...req.data,
			author: req.user.id,
			post: req.params.postId,
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
const commentUpdate = [
	verifyToken,
	verifyId("post"),
	verifyId("comment"),
	verifyScope("update_comment"),
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
			escape: true,
		},
	}),
	asyncHandler(async (req, res, next) => {
		const newComment = {
			...req.data,
			lastModified: new Date(),
		};

		await Comment.findByIdAndUpdate(
			req.params.commentId,
			newComment
		).exec();

		res.json({
			success: true,
			message: "Update comment successfully.",
		});
	}),
];
const commentDelete = [
	verifyToken,
	verifyId("comment"),
	verifyId("post"),
	verifyScope("delete_comment"),
	asyncHandler(async (req, res, next) => {
		await Comment.findByIdAndDelete(req.params.commentId).exec();

		res.json({
			success: true,
			message: "Delete comment successfully.",
		});
	}),
];
const commentReplyCreate = [
	verifyToken,
	verifyId("post"),
	verifyId("comment"),
	verifyScope("write_comment"),
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
			escape: true,
		},
	}),
	asyncHandler(async (req, res, next) => {
		const currentTime = new Date();

		const newComment = new Comment({
			...req.data,
			author: req.user.id,
			post: req.params.postId,
			lastModified: currentTime,
			createdAt: currentTime,
			reply: req.params.commentId,
		});

		await newComment.save();

		res.json({
			success: true,
			message: "Create comment reply successfully.",
		});
	}),
];

export {
	commentList,
	commentCreate,
	commentUpdate,
	commentDelete,
	commentReplyCreate,
};
