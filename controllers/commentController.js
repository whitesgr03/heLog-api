import asyncHandler from "express-async-handler";

import verifyToken from "../middlewares/verifyToken.js";
import verifyPermission from "../middlewares/verifyPermission.js";
import verifyId from "../middlewares/verifyId.js";
import verifySchema from "../middlewares/verifySchema.js";

import Comment from "../models/comment.js";

const commentList = [
	verifyId("post"),
	asyncHandler(async (req, res, next) => {
		const comments = await Comment.find(
			{ post: req.params.postId },
			{ post: 0 }
		)
			.populate("author", {
				name: 1,
				_id: 0,
			})
			.sort({ createdAt: -1 })
			.exec();

		res.json({
			success: true,
			message: "Get all comments successfully.",
			data: comments,
		});
	}),
];
const commentCreate = [
	verifyToken,
	verifyId("post"),
	verifySchema({
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
	verifyId("comment"),
	verifyPermission,
	verifySchema({
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
	verifyPermission,
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
	verifySchema({
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
