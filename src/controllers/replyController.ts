// Modules
import asyncHandler from "express-async-handler";
import { isValidObjectId, Types } from "mongoose";
import { body } from "express-validator";

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
			: await Comment.find(
					{ parent: new Types.ObjectId(`${commentId}`) },
					{},
					{
						skip: Number(skip),
						limit: 100,
						sort: {
							createdAt: 1,
							_id: -1,
						},
						populate: {
							path: "reply",
							select: {
								deleted: 1,
								author: 1,
							},
						},
					}
			  )
					.populate("author", {
						_id: 0,
						username: 1,
					})
					.populate({
						path: "reply",
						select: {
							deleted: 1,
							author: 1,
						},
						options: {
							populate: {
								path: "author",
								select: {
									_id: 0,
									username: 1,
								},
							},
						},
					})
					.exec();

		res.json({
			success: true,
			message: "Get all replies successfully.",
			data: replies,
		});
	}),
];

export const replyComment = [
	body("content")
		.trim()
		.notEmpty()
		.withMessage("Content is required.")
		.bail()
		.isLength({ max: 500 })
		.withMessage("Content must be less than 500 long."),
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

		const newReply = new Comment({
			author: req.user!.id,
			post: req.comment.post,
			parent: commentId,
			...req.data,
		});

		req.comment.child.push(newReply._id);

		await Promise.all([newReply.save(), req.comment.save()]);

		res.json({
			success: true,
			message: "Create comment successfully.",
			data: {
				_id: newReply._id,
			},
		});
	}),
];

export const replyCreate = [
	body("content")
		.trim()
		.notEmpty()
		.withMessage("Content is required.")
		.bail()
		.isLength({ max: 500 })
		.withMessage("Content must be less than 500 long."),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { replyId } = req.params;

		const comment =
			isValidObjectId(replyId) &&
			(await Comment.findOne({ child: replyId }).exec());

		const handleSetLocalVariable = () => {
			req.comment = comment;
			next();
		};

		comment
			? handleSetLocalVariable()
			: res.status(404).json({
					success: false,
					message: `Reply could not be found.`,
			  });
	}),
	asyncHandler(async (req, res) => {
		const { replyId } = req.params;

		const newReply = new Comment({
			author: req.user!.id,
			post: req.comment.post,
			parent: req.comment.id,
			reply: replyId,
			...req.data,
		});

		req.comment.child.push(newReply._id);

		await Promise.all([newReply.save(), req.comment.save()]);

		const createdReply = await Comment.findById(newReply._id)
			.populate("author", { username: 1, _id: 0 })
			.populate({
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
	body("content")
		.trim()
		.notEmpty()
		.withMessage("Content is required.")
		.bail()
		.isLength({ max: 500 })
		.withMessage("Content must be less than 500 long."),
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
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user!.id, {
			isAdmin: 1,
		}).exec();

		user?.isAdmin || user?.id.toString() === req.reply.author._id.toString()
			? next()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	}),
	asyncHandler(async (req, res) => {
		const { replyId } = req.params;
		req.reply.content = req.data.content;

		await req.reply.save();

		const updatedReply = await Comment.findById(replyId)
			.populate("author", {
				_id: 0,
				username: 1,
			})
			.populate({
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
		const user = await User.findById(req.user!.id, { isAdmin: 1 }).exec();

		const isReplyOwner =
			user?.id.toString() === req.reply.author._id.toString();

		const handleSetLocalVariable = () => {
			req.deletedByAdmin = user?.isAdmin && !isReplyOwner;
			next();
		};

		user?.isAdmin || isReplyOwner
			? handleSetLocalVariable()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	}),
	asyncHandler(async (req, res) => {
		const { replyId } = req.params;

		req.reply.content = req.deletedByAdmin
			? "Reply deleted by admin"
			: "Reply deleted by user";
		req.reply.deleted = true;

		await req.reply.save();

		const deletedReply = await Comment.findById(replyId)
			.populate("author", {
				_id: 0,
				username: 1,
			})
			.populate({
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
			message: "Delete reply successfully.",
			data: deletedReply,
		});
	}),
];
