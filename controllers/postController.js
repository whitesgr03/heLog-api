const asyncHandler = require("express-async-handler");
const { Types } = require("mongoose");

const verifyToken = require("../utils/verifyToken");
const verifyPostPermission = require("../utils/verifyPostPermission");
const verifyParamId = require("../utils/verifyParamId");
const verifySchema = require("../utils/verifySchema");

const Post = require("../models/post");

const postList = asyncHandler(async (req, res, next) => {
	const posts = await Post.find({})
		.populate("author", {
			name: 1,
			_id: 0,
		})
		.sort({ createdAt: 1 })
		.exec();

	res.json({
		success: true,
		message: "Get all posts successfully.",
		data: posts,
	});
});
const postDetail = [
	verifyParamId,
	asyncHandler(async (req, res, next) => {
		const post = await Post.findById(req.params.id)
			.populate("author", {
				name: 1,
				_id: 0,
			})
			.exec();

		post
			? res.json({
					success: true,
					message: "Get post successfully.",
					data: post,
			  })
			: res.status(404).json({
					success: false,
					message: "The post cannot be found.",
			  });
	}),
];
const postCreate = [
	verifyToken,
	verifyPostPermission,
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
	verifyPostPermission,
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
											req.params.id
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
	}),
	asyncHandler(async (req, res, next) => {
		const newPost = {
			...req.body,
			lastModified: new Date(),
		};

		await Post.findByIdAndUpdate(req.params.id, newPost).exec();

		res.json({
			success: true,
			message: "Update post successfully.",
		});
	}),
];
const postDelete = [
	verifyToken,
	verifyParamId,
	verifyPostPermission,
	asyncHandler(async (req, res, next) => {
		await Post.findByIdAndDelete(req.params.id).exec();

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
