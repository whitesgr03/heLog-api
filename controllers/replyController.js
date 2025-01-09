// Modules
import asyncHandler from "express-async-handler";
import { Types, isValidObjectId } from "mongoose";
import { checkSchema } from "express-validator";

// Middlewares
import { validationScheme } from "../middlewares/validationScheme.js";

import verifyToken from "../middlewares/verifyToken.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyId from "../middlewares/verifyId.js";
import verifyPermission from "../middlewares/verifyPermission.js";

// Models
import Post from "../models/post.js";
import Reply from "../models/reply.js";
import { Comment } from "../models/comment.js";

export const replyList = [
	asyncHandler(async (req, res) => {
		const { commentId } = req.params;
		const { skip = 0 } = req.query;

		const replies = !isValidObjectId(commentId)
			? []
			: await Comment.find({
					parent: commentId,
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
			message: "Get all replies successfully.",
			data: replies,
		});
	}),
];

export const replyCreate = [
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
		const { commentId } = req.params;

		const newReply = await new Comment({
			author: req.user.id,
			post: req.comment.post,
			parent: commentId,
			...req.data,
		}).save();

		const createdReply = await newReply.populate("author", {
			username: 1,
			_id: 0,
		});

		res.json({
			success: true,
			message: "Create comment successfully.",
			data: createdReply,
		});
	}),
];

export const replyUpdate = [
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
	asyncHandler(async (req, res, next) => {
		const { replyId } = req.params;

		const reply =
			isValidObjectId(replyId) &&
			(await Comment.findById(replyId).exec());

		const handleSetLocalVariable = () => {
			req.reply = reply;
			next();
		};

		reply
			? handleSetLocalVariable()
			: res.status(404).json({
					success: false,
					message: `Reply could not be found.`,
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, { isAdmin: 1 }).exec();

		const isReplyOwner =
			user._id.toString() === req.reply.author._id.toString();

		const handleSetLocalVariable = () => {
			req.deletedByAdmin = user.isAdmin && !isReplyOwner;
			next();
		};

		user.isAdmin || isReplyOwner
			? handleSetLocalVariable()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	}),
	asyncHandler(async (req, res) => {
		req.comment.content = req.deletedByAdmin
			? "Reply deleted by admin"
			: "Reply deleted by user";
		req.comment.deleted = true;

		const deletedReply = await req.reply.save();

		res.json({
			success: true,
			message: "Delete reply successfully.",
			data: deletedReply,
		});
	}),
];
