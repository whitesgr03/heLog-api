const asyncHandler = require("express-async-handler");
const { Types } = require("mongoose");
const cors = require("cors");

const verifyToken = require("../utils/verifyToken");
const verifyPermission = require("../utils/verifyPermission");
const verifyParamId = require("../utils/verifyParamId");
const verifySchema = require("../utils/verifySchema");

const Post = require("../models/post");

const corsOptions = {
	origin: "*",
	optionsSuccessStatus: 200,
};

const postList = [
	cors(corsOptions),
	asyncHandler(async (req, res, next) => {
		const posts = await Post.find({}).sort({ createdAt: 1 }).exec();

		res.json({
			success: true,
			message: "Get all posts successfully.",
			data: posts,
		});
	}),
];
const postDetail = [
	verifyParamId,
	asyncHandler(async (req, res, next) => {
		const post = await Post.findById(req.params.postId).exec();

		post
			? res.json({
					success: true,
					message: "Get post successfully.",
					data: post,
			  })
			: res.status(404).json({
					success: false,
					message: "The post could not be found.",
			  });
	}),
];
const postCreate = [
	verifyToken,
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
			...req.body,
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
	verifyParamId,
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
			...req.body,
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
	verifyParamId,
	verifyPermission,
	asyncHandler(async (req, res, next) => {
		await Post.findByIdAndDelete(req.params.postId).exec();

		res.json({
			success: true,
			message: "Delete post successfully.",
		});
	}),
];

module.exports = {
	postList,
	postDetail,
	postCreate,
	postUpdate,
	postDelete,
};
