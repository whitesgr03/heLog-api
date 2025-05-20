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

export const userPostList = [
	asyncHandler(async (req, res) => {
		const { skip = 0 } = req.query;

		const [userPosts, userPostsCount] = await Promise.all([
			Post.find(
				{ author: req.user.id },
				{ author: 0, mainImage: 0, content: 0 },
				{
					skip: Number(skip),
					limit: 100,
					sort: {
						createdAt: -1,
						_id: -1,
					},
				}
			).exec(),
			Post.countDocuments({ author: req.user.id }),
		]);

		res.json({
			success: true,
			message: "Get user's post list successfully.",
			data: { userPosts, userPostsCount },
		});
	}),
];
export const userDetail = [
	asyncHandler(async (req, res) => {
		const user = await User.findById(req.user.id, {
			username: 1,
			isAdmin: 1,
			email: 1,
		}).exec();

		res.set("Cache-Control", "no-store, max-age=0").json({
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
				options: username =>
					username.match(/^([a-zA-Z0-9](-|_|\s)?)*[a-zA-Z0-9]$/),
				errorMessage: "Username must be alphanumeric.",
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
						$ne: new Types.ObjectId(`${req.user.id}`),
					},
				},
			],
		}).exec();

		existingUserName
			? res.status(409).json({
					success: false,
					fields: {
						username: "Username is been used.",
					},
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
					email: 1,
				},
			}
		).exec();

		res.set("Cache-Control", "no-store, max-age=0").json({
			success: true,
			message: "Update user successfully.",
			data: user,
		});
	}),
];
export const userDelete = [
	asyncHandler(async (req, res) => {
		const posts = await Post.find(
			{ author: req.user.id },
			{ _id: 1 }
		).exec();

		await Promise.all([
			...posts.map(async post => {
				Promise.all([
					Comment.deleteMany({ post: post._id }).exec(),
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
		]);

		req.logout(() =>
			res
				.clearCookie("id")
				.clearCookie("token")
				.set("Clear-Site-Data", ["cache", "cookies", "storage"])
				.json({
					success: true,
					message: "Delete user successfully.",
				})
		);
	}),
];
