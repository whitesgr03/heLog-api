import asyncHandler from "express-async-handler";
import { Types, isValidObjectId } from "mongoose";

import verifyToken from "../middlewares/verifyToken.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyId from "../middlewares/verifyId.js";
import verifyPermission from "../middlewares/verifyPermission.js";

import Post from "../models/post.js";
import Reply from "../models/reply.js";
import Comment from "../models/comment.js";

const replyList = [
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

		const replies = await Reply.find(filter)
			.populate("author", {
				name: 1,
			})
			.populate({
				path: "reply",
				select: "author deleted",
				populate: { path: "author", select: "name -_id" },
			})
			.limit(limit)
			.sort()
			.exec();

		res.header({
			"Cache-Control": "no-store",
		}).json({
			success: true,
			message: "Get all replies successfully.",
			data: replies,
		});
	}),
];
const replyCreate = [
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
		comment: {
			trim: true,
			notEmpty: {
				errorMessage: "The comment is required.",
				bail: true,
			},
			custom: {
				options: id => isValidObjectId(id),
				errorMessage: "The comment is invalid object ID.",
				bail: true,
			},
			custom: {
				options: (id, { req }) =>
					new Promise(async (resolve, reject) => {
						const isExisting = await Comment.findById(id).exec();

						isExisting && (!isExisting?.deleted || req.body.reply)
							? resolve()
							: reject();
					}),
				errorMessage: "The comment could not be found.",
			},
			escape: true,
		},
		reply: {
			optional: true,
			trim: true,
			custom: {
				options: id => isValidObjectId(id),
				errorMessage: "The reply is invalid object ID.",
				bail: true,
			},
			custom: {
				options: id =>
					new Promise(async (resolve, reject) => {
						const isExisting = await Reply.findById(id).exec();
						isExisting ? resolve() : reject();
					}),
				errorMessage: "The reply could not be found.",
			},
			escape: true,
		},
	}),
	asyncHandler(async (req, res, next) => {
		const currentTime = new Date();

		const newReply = new Reply({
			...req.data,
			author: req.user.id,
			lastModified: currentTime,
			createdAt: currentTime,
		});

		await newReply.save();

		res.json({
			success: true,
			message: "Create reply successfully.",
		});
	}),
];
const replyUpdate = [
	verifyToken,
	verifyId("reply"),
	verifyPermission("reply"),
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

		await Reply.findByIdAndUpdate(req.params.replyId, newComment).exec();

		res.json({
			success: true,
			message: "Update comment successfully.",
		});
	}),
];
const replyDelete = [
	verifyToken,
	verifyId("reply"),
	verifyPermission("reply"),
	asyncHandler(async (req, res, next) => {
		const currentTime = new Date();

		const newReply = {
			content: "Reply deleted by user",
			lastModified: currentTime,
			deleted: true,
		};

		await Reply.findByIdAndUpdate(req.params.replyId, newReply).exec();

		res.json({
			success: true,
			message: "Delete reply successfully.",
		});
	}),
];

export { replyList, replyCreate, replyUpdate, replyDelete };

// 查一下為何刪除 comment 後 reply 無法回復其他 reply, verifyJSONSchema comment could not be found
