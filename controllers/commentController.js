// Modules
import asyncHandler from "express-async-handler";
import { isValidObjectId, Types } from "mongoose";
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
					post: new Types.ObjectId(`${postId}`),
			  })
					.populate("author", {
						username: 1,
					})
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(10)
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

export { commentList, commentCreate, commentUpdate, commentDelete };
