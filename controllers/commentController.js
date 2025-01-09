// Modules
import asyncHandler from "express-async-handler";
import { isValidObjectId } from "mongoose";
import { checkSchema } from "express-validator";

// Middlewares
import { validationScheme } from "../middlewares/validationScheme.js";

// Models
import { User } from "../models/user.js";
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
		const { postId } = req.params;

		const post =
			isValidObjectId(postId) && (await Post.findById(postId).exec());

		post
			? next()
			: res.status(404).json({
					success: false,
					message: `Post could not be found.`,
			  });
	}),
	asyncHandler(async (req, res) => {
		const { postId } = req.params;

		const newComment = await new Comment({
			author: req.user.id,
			post: postId,
			...req.data,
		}).save();

		const createdComment = await newComment.populate("author", {
			username: 1,
			_id: 0,
		});

		res.json({
			success: true,
			message: "Create comment successfully.",
			data: createdComment,
		});
	}),
];

export const commentUpdate = [
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
			(await Comment.findById(commentId)
				.populate("author", {
					username: 1,
					_id: 0,
				})
				.exec());

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
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, { isAdmin: 1 }).exec();

		user.isAdmin ||
		user._id.toString() === req.comment.author._id.toString()
			? next()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	}),
	asyncHandler(async (req, res) => {
		req.comment.content = req.data.content;

		const comment = await req.comment.save();

		const updatedComment = {
			...comment._doc,
			author: { username: comment._doc.author.username },
		};

		res.json({
			success: true,
			message: "Update comment successfully.",
			data: updatedComment,
		});
	}),
];

export const commentDelete = [
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
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, { isAdmin: 1 }).exec();

		const isCommentOwner =
			user._id.toString() === req.comment.author._id.toString();

		const handleSetLocalVariable = () => {
			req.deletedByAdmin = user.isAdmin && !isCommentOwner;
			next();
		};

		user.isAdmin || isCommentOwner
			? handleSetLocalVariable()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	}),
	asyncHandler(async (req, res) => {
		req.comment.content = req.deletedByAdmin
			? "Comment deleted by admin"
			: "Comment deleted by user";
		req.comment.deleted = true;

		const comment = await req.comment.save();

		const { _author, ...deletedComment } = comment._doc;

		res.json({
			success: true,
			message: "Delete comment successfully.",
			data: deletedComment,
		});
	}),
];
