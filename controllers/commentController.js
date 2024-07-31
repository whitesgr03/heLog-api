import asyncHandler from "express-async-handler";
import { isValidObjectId, Types } from "mongoose";

import verifyToken from "../middlewares/verifyToken.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyId from "../middlewares/verifyId.js";
import verifyPermission from "../middlewares/verifyPermission.js";

import Post from "../models/post.js";
import Comment from "../models/comment.js";

const commentList = [
	asyncHandler((req, res, next) => {
		const { postId = null } = req.query;

		!postId || isValidObjectId(postId)
			? next()
			: res.status(400).json({
					success: false,
					message: "The postId query is invalid object id..",
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
		post: {
			trim: true,
			notEmpty: {
				errorMessage: "The post is required.",
				bail: true,
			},
			custom: {
				options: id => isValidObjectId(id),
				errorMessage: "The post is invalid object ID.",
				bail: true,
			},
			custom: {
				options: id =>
					new Promise(async (resolve, reject) => {
						const isExisting = await Post.findById(id).exec();
						isExisting ? resolve() : reject();
					}),
				errorMessage: "The post could not be found.",
			},
			escape: true,
		},
	}),
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
const commentUpdate = [
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
			escape: true,
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
const commentDelete = [
	verifyToken,
	verifyId("comment"),
	verifyPermission("comment"),
	asyncHandler(async (req, res, next) => {
		const currentTime = new Date();

		const newComment = {
			content: "Comment deleted by user",
			lastModified: currentTime,
			deleted: true,
		};

		await Comment.findByIdAndUpdate(
			req.params.commentId,
			newComment
		).exec();

		res.json({
			success: true,
			message: "Delete comment successfully.",
		});
	}),
];

export { commentList, commentCreate, commentUpdate, commentDelete };
