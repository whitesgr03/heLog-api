import asyncHandler from "express-async-handler";
import { Types, isValidObjectId } from "mongoose";
import https from "node:https";
import DOMPurify from "isomorphic-dompurify";

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
					message: "The query is invalid.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const { limit = 0, userId = null } = req.query;

		const filter = {};

		userId
			? (filter.author = new Types.ObjectId(userId))
			: (filter.publish = true);

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
		res.header({
			"Cache-Control": "no-store",
		}).json({
			success: true,
			message: "Get post successfully.",
			data: req.post,
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
			custom: {
				options: content => {
					const wordCountLimit = 8000;

					const words = content
						.match(/(?<=>)[^<>\n]+(?=<)/g)
						?.join(" ")
						?.replace(/\s/g, "");

					const escapeCount = words?.match(/(?<=)&[\w]+;(?=)/g) ?? [];

					const wordCount = words?.replace(/(?<=)&[\w]+;(?=)/g, "");

					return (
						escapeCount.length + wordCount.length <= wordCountLimit
					);
				},

				errorMessage: "The content must be less than 8000 long.",
			},
		},
		publish: {
			optional: true,
			trim: true,
			toLowerCase: true,
			isBoolean: {
				errorMessage: "The publish must be boolean.",
			},
		},
	}),
	asyncHandler(async (req, res, next) => {
		const currentTime = new Date();

		const newPost = new Post({
			...req.data,
			title: DOMPurify.sanitize(req.data.title),
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
		},
		mainImage: {
			optional: true,
			trim: true,
			custom: {
				options: mainImage =>
					mainImage === "" ||
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
			custom: {
				options: content => {
					const wordCountLimit = 8000;

					const words = content
						.match(/(?<=>)[^<>\n]+(?=<)/g)
						?.join(" ")
						?.replace(/\s/g, "");

					const escapeCount = words?.match(/(?<=)&[\w]+;(?=)/g) ?? [];

					const wordCount = words?.replace(/(?<=)&[\w]+;(?=)/g, "");

					return (
						escapeCount.length + wordCount.length <= wordCountLimit
					);
				},

				errorMessage: "The content must be less than 8000 long.",
			},
		},
		publish: {
			optional: true,
			trim: true,
			toLowerCase: true,
			isBoolean: {
				errorMessage: "The publish must be boolean.",
			},
		},
	}),
	asyncHandler(async (req, res, next) => {
		const { title, mainImage, content, publish } = req.data;

		(title || title === "") && (req.post.title = DOMPurify.sanitize(title));
		(mainImage || mainImage === "") && (req.post.mainImage = mainImage);
		(content || content === "") && (req.post.content = content);
		(publish || publish === "") && (req.post.publish = publish);

		req.post.lastModified = new Date();

		await req.post.save();

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
		await req.post.deleteOne();

		res.json({
			success: true,
			message: "Delete post successfully.",
		});
	}),
];

export { postList, postDetail, postCreate, postUpdate, postDelete };
