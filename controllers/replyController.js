import asyncHandler from "express-async-handler";
import { Types, isValidObjectId } from "mongoose";

import verifyToken from "../middlewares/verifyToken.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyId from "../middlewares/verifyId.js";
import verifyPermission from "../middlewares/verifyPermission.js";

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

		await req.reply.save();

		res.json({
			success: true,
			message: "Update reply successfully.",
		});
	}),
];
export const replyDelete = [
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
