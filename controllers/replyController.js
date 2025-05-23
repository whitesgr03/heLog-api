// Modules
import asyncHandler from "express-async-handler";
import { isValidObjectId, Types } from "mongoose";
import { checkSchema } from "express-validator";

// Middlewares
import { validationScheme } from "../middlewares/validationScheme.js";

// Models
import { Comment } from "../models/comment.js";
import { User } from "../models/user.js";

export const replyList = [
	asyncHandler(async (req, res) => {
		const { commentId } = req.params;
		const { skip = 0 } = req.query;

		const replies = !isValidObjectId(commentId)
			? []
			: await Comment.aggregate([
					{
						$match: {
							parent: new Types.ObjectId(`${commentId}`),
						},
					},
					{
						$sort: {
							createdAt: 1,
							_id: 1,
						},
					},
					{ $skip: Number(skip) },
					{ $limit: 10 },
					{
						$lookup: {
							from: "users",
							localField: "author",
							foreignField: "_id",
							as: "author",
							pipeline: [
								{
									$project: {
										_id: 0,
										username: 1,
									},
								},
							],
						},
					},
					{
						$unwind: {
							path: "$author",
						},
					},
					{
						$lookup: {
							from: "comments",
							localField: "reply",
							foreignField: "_id",
							as: "reply",
							pipeline: [
								{
									$project: {
										deleted: 1,
										author: 1,
									},
								},
								{
									$lookup: {
										from: "users",
										localField: "author",
										foreignField: "_id",
										as: "author",
										pipeline: [
											{
												$project: {
													_id: 0,
													username: 1,
												},
											},
										],
									},
								},
								{
									$unwind: {
										path: "$author",
									},
								},
							],
						},
					},
					{
						$unwind: {
							path: "$reply",
							preserveNullAndEmptyArrays: true,
						},
					},
			  ]);

		res.json({
			success: true,
			message: "Get all replies successfully.",
			data: replies,
		});
	}),
];

export const replyComment = [
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
	asyncHandler(async (req, res) => {
		const { replyId } = req.params;

		const newReply = await new Comment({
			author: req.user.id,
			post: req.reply.post,
			parent: req.reply.parent,
			reply: replyId,
			...req.data,
		}).save();

		let createdReply = await newReply.populate({
			path: "author",
			select: {
				username: 1,
				_id: 0,
			},
		});

		createdReply = await newReply.populate({
			path: "reply",
			select: {
				author: 1,
				deleted: 1,
			},
			populate: {
				path: "author",
				select: {
					username: 1,
					_id: 0,
				},
			},
		});

		res.json({
			success: true,
			message: "Create reply successfully.",
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
		const { replyId } = req.params;

		const reply =
			isValidObjectId(replyId) &&
			(await Comment.findById(replyId)
				.populate("author", {
					username: 1,
				})
				.exec());

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

		user.isAdmin || user._id.toString() === req.reply.author._id.toString()
			? next()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	}),
	asyncHandler(async (req, res) => {
		req.reply.content = req.data.content;

		const reply = await req.reply.save();

		const updatedReply = req.reply?.reply
			? await reply.populate({
					path: "reply",
					select: {
						author: 1,
						deleted: 1,
					},
					populate: {
						path: "author",
						select: {
							username: 1,
							_id: 0,
						},
					},
			  })
			: reply._doc;

		updatedReply.author = { username: reply._doc.author.username };

		res.json({
			success: true,
			message: "Update reply successfully.",
			data: updatedReply,
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
		req.reply.content = req.deletedByAdmin
			? "Reply deleted by admin"
			: "Reply deleted by user";
		req.reply.deleted = true;

		const reply = await req.reply.save();

		const { _author, ...deletedReply } = reply._doc;

		res.json({
			success: true,
			message: "Delete reply successfully.",
			data: deletedReply,
		});
	}),
];
