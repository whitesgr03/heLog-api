// Modules
import asyncHandler from "express-async-handler";
import { Types } from "mongoose";
import { checkSchema } from "express-validator";

// Middlewares
import { validationScheme } from "../middlewares/validationScheme.js";

// Models
import { User } from "../models/user.js";
import { Post } from "../models/post.js";
import { Comment } from "../models/comment.js";
import { Reply } from "../models/reply.js";

export const userPostList = [
	asyncHandler(async (req, res) => {
		const posts = await Post.find({ author: req.user.id }).exec();

		res.json({
			success: true,
			message: "Get user's post list successfully.",
			data: posts,
		});
	}),
];
export const userDetail = [
	asyncHandler(async (req, res) => {
		const user = await User.findById(req.user.id, {
			username: 1,
			isAdmin: 1,
		}).exec();

		res.json({
			success: true,
			message: "Get user info successfully.",
			data: user,
		});
	}),
];
export const userUpdate = [
	checkSchema({
		username: {
			trim: true,
			notEmpty: {
				errorMessage: "Username is required.",
				bail: true,
			},
			isLength: {
				options: { max: 30 },
				errorMessage: "username must be less than 30 long.",
				bail: true,
			},
			custom: {
				options: username => username.match(/^[a-zA-Z]\w*$/),
				errorMessage: "Username must be alphanumeric and underscore.",
				bail: true,
			},
		},
	}),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { username } = req.data;
		const existingUserName = await User.findOne({
			$and: [
				{ username },
				{
					_id: {
						$ne: Types.ObjectId.createFromHexString(req.user.id),
					},
				},
			],
		}).exec();

		existingUserName
			? res.json({
					success: false,
					message: "Username is been used.",
			  })
			: next();
	}),
	asyncHandler(async (req, res) => {
		const user = await User.findByIdAndUpdate(
			req.user.id,
			{ ...req.data },
			{
				new: true,
				select: {
					username: 1,
					isAdmin: 1,
				},
			}
		).exec();

		res.json({
			success: true,
			message: "Update user successfully.",
			data: user,
		});
	}),
];
export const userDelete = [
	asyncHandler(async (req, res, next) => {
		const posts = await Post.find(
			{ author: req.user.id },
			{ _id: 1 }
		).exec();

		await Promise.all([
			...posts.map(async post => {
				Promise.all([
					Comment.deleteMany({ post: post._id }).exec(),
					Reply.deleteMany({ post: post._id }).exec(),
					post.deleteOne(),
				]);
			}),
			User.findByIdAndDelete(req.user.id).exec(),
			Comment.updateMany(
				{
					author: req.user.id,
				},
				{
					content: "Comment deleted by user",
					deleted: true,
				}
			).exec(),
			Reply.updateMany(
				{
					author: req.user.id,
				},
				{
					content: "Reply deleted by user",
					deleted: true,
				}
			).exec(),
		]);

		next();
	}),
	(req, res, next) => {
		req.logout(err =>
			err
				? next(err)
				: res.json({
						success: true,
						message: "Delete user successfully.",
				  })
		);
	},
];
