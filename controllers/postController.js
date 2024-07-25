import asyncHandler from "express-async-handler";
import { Types, isValidObjectId } from "mongoose";
import https from "node:https";

import verifyToken from "../middlewares/verifyToken.js";
import verifyPermission from "../middlewares/verifyPermission.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyId from "../middlewares/verifyId.js";

import Post from "../models/post.js";

const postList = [
	asyncHandler((req, res, next) => {
		const { userId = null } = req.query;

		!userId || isValidObjectId(userId)
			? next()
			: res.status(400).json({
					success: false,
					message: "The query is invalid object ID.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const { limit = 0, userId = null } = req.query;

		const filter = {};

		!userId && (filter.publish = true);

		userId && (filter.author = new Types.ObjectId(userId));

		const posts = await Post.find(filter)
			.populate("author", {
				name: 1,
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
	verifyJSONSchema({
		title: {
			optional: true,
			trim: true,
			isLength: {
				options: { max: 100 },
				errorMessage: "The title must be less than 100 long.",
				bail: true,
			},
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
			escape: true,
		},
		mainImage: {
			optional: true,
			trim: true,
			custom: {
				options: mainImage =>
					new Promise((resolve, reject) => {
						const source = mainImage.match(
							/(?<=img src=")(.*?)(?=")/g
						);

						const handleMimeType = () => {
							https
								.request(source[0], res => {
									const mimeType =
										res.headers["content-type"];
									res.statusCode === 200 &&
									(mimeType === "image/jpeg" ||
										mimeType === "image/png" ||
										mimeType === "image/webp")
										? resolve()
										: reject();
								})
								.on("error", () => reject())
								.end();
						};

						source ? handleMimeType() : reject();
					}),

				errorMessage: "The main image is invalid.",
			},
		},
		content: {
			optional: true,
			trim: true,
		},
		publish: {
			optional: true,
			trim: true,
			toLowerCase: true,
			isBoolean: {
				errorMessage: "The publish must be boolean.",
			},
			escape: true,
		},
	}),
	asyncHandler(async (req, res, next) => {
		const currentTime = new Date();

		const newPost = new Post({
			publish: false,
			...req.data,
			author: req.user.id,
			lastModified: currentTime,
			createdAt: currentTime,
		});

		await newPost.save();

		res.json({
			success: true,
			data: {
				post: { id: newPost._id },
			},
			message: "Create post successfully.",
		});
	}),
];
const postUpdate = [
	verifyToken,
	verifyId("post"),
	verifyPermission("post"),
	verifyJSONSchema({
		title: {
			optional: true,
			trim: true,
			isLength: {
				options: { max: 100 },
				errorMessage: "The title must be less than 100 long.",
				bail: true,
			},
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
			escape: true,
		},
		content: {
			optional: true,
			trim: true,
		},
		mainImage: {
			optional: true,
			trim: true,
			custom: {
				options: mainImage =>
					new Promise((resolve, reject) => {
						const source = mainImage.match(
							/(?<=img src=")(.*?)(?=")/g
						);

						const handleMimeType = () => {
							https
								.request(source[0], res => {
									const mimeType =
										res.headers["content-type"];
									res.statusCode === 200 &&
									(mimeType === "image/jpeg" ||
										mimeType === "image/png" ||
										mimeType === "image/webp")
										? resolve()
										: reject();
								})
								.on("error", () => reject())
								.end();
						};

						source ? handleMimeType() : reject();
					}),
				errorMessage: "The main image is invalid.",
			},
		},
		publish: {
			optional: true,
			trim: true,
			toLowerCase: true,
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
	verifyPermission("post"),
	asyncHandler(async (req, res, next) => {
		await Post.findByIdAndDelete(req.params.postId).exec();

		res.json({
			success: true,
			message: "Delete post successfully.",
		});
	}),
];

export { postList, postDetail, postCreate, postUpdate, postDelete };
