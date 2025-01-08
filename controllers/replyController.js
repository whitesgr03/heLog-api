import asyncHandler from "express-async-handler";
import { Types, isValidObjectId } from "mongoose";

import verifyToken from "../middlewares/verifyToken.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyId from "../middlewares/verifyId.js";
import verifyPermission from "../middlewares/verifyPermission.js";

import Post from "../models/post.js";
import Reply from "../models/reply.js";
import Comment from "../models/comment.js";

export const replyList = [
	asyncHandler((req, res, next) => {
		const { postId = null } = req.query;

		!postId || isValidObjectId(postId)
			? next()
			: res.status(400).json({
					success: false,
					message: "The post query is invalid object id.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const { postId = null } = req.query;

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

export const replyCreate = [
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
export const replyUpdate = [
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
		},
	}),
	asyncHandler(async (req, res, next) => {
		req.reply.content = req.data.content;
		req.reply.lastModified = new Date();

		await req.reply.save();

		res.json({
			success: true,
			message: "Update reply successfully.",
		});
	}),
];
export const replyDelete = [
	verifyToken,
	verifyId("reply"),
	verifyPermission("reply"),
	asyncHandler(async (req, res, next) => {
		req.reply.content = "Reply deleted by user";
		req.reply.lastModified = new Date();
		req.reply.deleted = true;

		await req.reply.save();

		res.json({
			success: true,
			message: "Delete reply successfully.",
		});
	}),
];
