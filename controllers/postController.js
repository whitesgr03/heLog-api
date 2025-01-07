// Modules
import https from "node:https";
import asyncHandler from "express-async-handler";
import { checkSchema } from "express-validator";
import { isValidObjectId } from "mongoose";

// Middlewares
import { validationScheme } from "../middlewares/validationScheme.js";

// Models
import { User } from "../models/user.js";
import { Post } from "../models/post.js";
import { Comment } from "../models/comment.js";
import { Reply } from "../models/reply.js";

export const postList = [
	asyncHandler(async (req, res) => {
		const { skip = 0 } = req.query;

		const posts = await Post.find({ publish: true })
			.populate("author", {
				username: 1,
				_id: 0,
			})
			.skip(skip)
			.limit(10)
			.sort({ createdAt: -1 })
			.exec();

		res.json({
			success: true,
			message: "Get all posts successfully.",
			data: posts,
		});
	}),
];

export const postDetail = [
	asyncHandler(async (req, res) => {
		const { postId } = req.params;

		const post = await Post.findOne({ _id: postId })
			.populate("author", {
				username: 1,
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
					message: `Post could not be found.`,
			  });
	}),
];

export const postCreate = [
	checkSchema({
		title: {
			unescape: true,
			optional: true,
			trim: true,
			isLength: {
				options: { max: 100 },
				errorMessage: "The title must be less than 100 long.",
				bail: true,
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
	validationScheme,
	asyncHandler(async (req, res) => {
		const newPost = new Post({
			...req.data,
			author: req.user.id,
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

export const postUpdate = [
	checkSchema({
		title: {
			unescape: true,
			optional: true,
			trim: true,
			isLength: {
				options: { max: 100 },
				errorMessage: "The title must be less than 100 long.",
				bail: true,
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
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { postId } = req.params;

		const post =
			isValidObjectId(postId) &&
			(await Post.findById(postId, { createdAt: 0 })
				.populate("author")
				.exec());

		const handleSetLocalVariable = () => {
			req.post = post;
			next();
		};

		post
			? handleSetLocalVariable()
			: res.status(404).json({
					success: false,
					message: `Post could not be found.`,
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, { isAdmin: 1 }).exec();

		user.isAdmin || user._id.toString() === req.post.author._id.toString()
			? next()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	}),
	asyncHandler(async (req, res) => {
		const { title, mainImage, content, publish } = req.data;

		(title || title === "") && (req.post.title = title);
		(mainImage || mainImage === "") && (req.post.mainImage = mainImage);
		(content || content === "") && (req.post.content = content);
		(publish || publish === "") && (req.post.publish = publish);

		const post = await Post.findByIdAndUpdate(
			req.post._id,
			{
				title,
				mainImage,
				content,
				publish,
			},
			{ new: true, select: { createdAt: 0, author: 0 } }
		);

		res.json({
			success: true,
			message: "Update post successfully.",
			data: post,
		});
	}),
];

export const postDelete = [
	asyncHandler(async (req, res, next) => {
		const { postId } = req.params;

		const post =
			isValidObjectId(postId) &&
			(await Post.findById(postId).populate("author").exec());

		const handleSetLocalVariable = () => {
			req.post = post;
			next();
		};

		post
			? handleSetLocalVariable()
			: res.status(404).json({
					success: false,
					message: `Post could not be found.`,
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, { isAdmin: 1 }).exec();

		user.isAdmin || user._id.toString() === req.post.author._id.toString()
			? next()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	}),
	asyncHandler(async (req, res) => {
		await Promise.all([
			Comment.deleteMany({ post: req.params.postId }).exec(),
			Reply.deleteMany({ post: req.params.postId }).exec(),
			req.post.deleteOne(),
		]);

		res.json({
			success: true,
			message: "Delete post successfully.",
		});
	}),
];
