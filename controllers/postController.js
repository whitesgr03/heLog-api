import asyncHandler from "express-async-handler";
import { Types } from "mongoose";

import verifyToken from "../middlewares/verifyToken.js";
import verifyScope from "../middlewares/verifyScope.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyId from "../middlewares/verifyId.js";

import Post from "../models/post.js";

const postList = [
	asyncHandler(async (req, res, next) => {
		const { limit = 0, author = false } = req.query;

		const filter = {};

		!author && (filter.publish = true);

		author && (filter.author = new Types.ObjectId(author));

		const posts = await Post.find(filter, { publish: 0 })
			.populate("author", {
				name: 1,
				_id: 0,
			})
			.sort({ createdAt: -1 })
			.limit(limit)
			.exec();

		res.header({
			"Cache-Control": "no-store",
		}).json({
			success: true,
			message: "Get all posts successfully.",
			data: posts,
		});
	}),
];
const postDetail = [
	verifyId("post"),
	asyncHandler(async (req, res, next) => {
		const post = await Post.findById(req.params.postId)
			.populate("author", {
				name: 1,
				_id: 0,
			})
			.exec();

		res.header({
			"Cache-Control": "no-store",
		}).json({
			success: true,
			message: "Get post successfully.",
			data: post,
		});
	}),
];
const postCreate = [
	verifyToken,
	verifyScope("write_post"),
	verifyJSONSchema({
		title: {
			trim: true,
			notEmpty: {
				errorMessage: "The title is required.",
				bail: true,
			},
			isLength: {
				options: { max: 100 },
				errorMessage: "The title must be less than 100 long.",
				bail: true,
			},
			escape: true,
			custom: {
				options: (title, { req }) =>
					new Promise(async (resolve, reject) => {
						const existingTitle = await Post.findOne({
							title,
						}).exec();
						existingTitle
							? reject((req.schema = { isConflict: true }))
							: resolve();
					}),
				errorMessage: "The title is been used.",
			},
		},
		content: {
			trim: true,
			notEmpty: {
				errorMessage: "The content is required.",
			},
			escape: true,
		},
		publish: {
			trim: true,
			toLowerCase: true,
			notEmpty: {
				errorMessage: "The publish is required.",
				bail: true,
			},
			isBoolean: {
				errorMessage: "The publish must be boolean.",
			},
			escape: true,
		},
	}),
	asyncHandler(async (req, res, next) => {
		const currentTime = new Date();

		const newPost = new Post({
			...req.data,
			author: req.user.id,
			lastModified: currentTime,
			createdAt: currentTime,
		});

		await newPost.save();

		res.json({
			success: true,
			message: "Create post successfully.",
		});
	}),
];
const postUpdate = [
	verifyToken,
	verifyId("post"),
	verifyPermission,
	verifySchema({
		title: {
			trim: true,
			notEmpty: {
				errorMessage: "The title is required.",
				bail: true,
			},
			isLength: {
				options: { max: 100 },
				errorMessage: "The title must be less than 100 long.",
				bail: true,
			},
			escape: true,
			custom: {
				options: (title, { req }) =>
					new Promise(async (resolve, reject) => {
						const existingTitle = await Post.findOne({
							$and: [
								{ title },
								{
									_id: {
										$ne: Types.ObjectId.createFromHexString(
											req.params.postId
										),
									},
								},
							],
						}).exec();
						existingTitle
							? reject((req.schema = { isConflict: true }))
							: resolve();
					}),
				errorMessage: "The title is been used.",
			},
		},
		content: {
			trim: true,
			notEmpty: {
				errorMessage: "The content is required.",
			},
			escape: true,
		},
		publish: {
			trim: true,
			toLowerCase: true,
			notEmpty: {
				errorMessage: "The publish is required.",
				bail: true,
			},
			isBoolean: {
				errorMessage: "The publish must be boolean.",
			},
			escape: true,
		},
	}),
	asyncHandler(async (req, res, next) => {
		const newPost = {
			...req.data,
			lastModified: new Date(),
		};

		await Post.findByIdAndUpdate(req.params.postId, newPost).exec();

		res.json({
			success: true,
			message: "Update post successfully.",
		});
	}),
];
const postDelete = [
	verifyToken,
	verifyId("post"),
	verifyPermission,
	asyncHandler(async (req, res, next) => {
		await Post.findByIdAndDelete(req.params.postId).exec();

		res.json({
			success: true,
			message: "Delete post successfully.",
		});
	}),
];

export { postList, postDetail, postCreate, postUpdate, postDelete };
