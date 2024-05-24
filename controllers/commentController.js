const asyncHandler = require("express-async-handler");

const verifyToken = require("../utils/verifyToken");
const verifyPermission = require("../utils/verifyPermission");
const verifyParamId = require("../utils/verifyParamId");
const verifySchema = require("../utils/verifySchema");

const Comment = require("../models/comment");

const commentList = [
	verifyParamId,
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
	verifyParamId,
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
			...req.body,
			author: req.user.id,
			post: req.params.postId,
			lastModified: currentTime,
			createdAt: currentTime,
		});

		const reply = req.params.commentId;
		reply && (newComment.reply = reply);

		await newComment.save();

		res.json({
			success: true,
			message: "Create comment successfully.",
		});
	}),
];
const commentUpdate = [
	verifyToken,
	verifyParamId,
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
			...req.body,
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
	verifyParamId,
	verifyPermission,
	asyncHandler(async (req, res, next) => {
		await Comment.findByIdAndDelete(req.params.commentId).exec();

		res.json({
			success: true,
			message: "Delete comment successfully.",
		});
	}),
];

module.exports = {
	commentList,
	commentCreate,
	commentUpdate,
	commentDelete,
};
