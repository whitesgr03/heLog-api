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
		const user = await User.findById(req.user.id, {
			name: 1,
			isAdmin: 1,
			email: 1,
		}).exec();

		res.header({
			"Cache-Control": "no-store",
		}).json({
			success: true,
			message: "Get user info successfully.",
			data: user,
		});
	}),
];
const userUpdate = [
	verifyToken,
	verifyJSONSchema({
		name: {
			trim: true,
			notEmpty: {
				errorMessage: "The name is required.",
				bail: true,
			},
			isLength: {
				options: { max: 30 },
				errorMessage: "The name must be less than 30 long.",
				bail: true,
			},
			custom: {
				options: name => name.match(/^[a-zA-Z]\w*$/),
				errorMessage: "The name must be alphanumeric and underscore.",
				bail: true,
			},
			custom: {
				options: (name, { req }) =>
					new Promise(async (resolve, reject) => {
						const existingName = await User.findOne({
							$and: [
								{ name },
								{
									_id: {
										$ne: Types.ObjectId.createFromHexString(
											req.user.id
										),
									},
								},
							],
						}).exec();
						existingName
							? reject((req.schema = { isConflict: true }))
							: resolve();
					}),
				errorMessage: "The name is been used.",
			},
		},
	}),
	asyncHandler(async (req, res, next) => {
		const newUser = {
			...req.data,
			lastModified: new Date(),
		};
		const user = await User.findByIdAndUpdate(req.user.id, newUser, {
			new: true,
			select: {
				name: 1,
			},
		}).exec();

		res.json({
			success: true,
			message: "Update user successfully.",
			data: user,
		});
	}),
];
const userDelete = [
	verifyToken,
	asyncHandler(async (req, res, next) => {
		const posts = await Post.find(
			{ author: req.user.id },
			{ _id: 1 }
		).exec();

		const currentTime = new Date();

		await Promise.all([
			...posts.map(async post => {
				Promise.all([
					Comment.deleteMany({ post: post._id }).exec(),
					Reply.deleteMany({ post: post._id }).exec(),
					post.deleteOne(),
				]);
			}),
			User.findByIdAndDelete(req.user.id).exec(),
			RefreshToken.findOneAndDelete({
				user: req.user.id,
			}).exec(),
			FederatedCredential.findOneAndDelete({
				user: req.user.id,
			}).exec(),
			Comment.updateMany(
				{
					author: req.user.id,
				},
				{
					content: "Comment deleted by user",
					lastModified: currentTime,
					deleted: true,
				}
			).exec(),
			Reply.updateMany(
				{
					author: req.user.id,
				},
				{
					content: "Reply deleted by user",
					lastModified: currentTime,
					deleted: true,
				}
			).exec(),
		]);

		sessionStore.destroy(req.payload.sid, err =>
			err
				? next(err)
				: res.clearCookie("helog.connect.sid").json({
						success: true,
						message: "Delete user successfully.",
				  })
		);
	}),
];
