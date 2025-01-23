// Modules
import https from "node:https";
import asyncHandler from "express-async-handler";
import { checkSchema } from "express-validator";
import { isValidObjectId, Types } from "mongoose";

// Middlewares
import { validationScheme } from "../middlewares/validationScheme.js";

// Models
import { User } from "../models/user.js";
import { Post } from "../models/post.js";
import { Comment } from "../models/comment.js";

export const postList = [
	asyncHandler(async (req, res) => {
		const { skip = 0 } = req.query;

		const pipeline = [
			{
				$match: {
					publish: true,
				},
			},
			{
				$facet: {
					posts: [
						{
							$sort: {
								createdAt: -1,
								_id: -1,
							},
						},
						{ $skip: Number(skip) },
						{ $limit: 10 },
						{
							$set: {
								mainImageUrl: {
									$regexFind: {
										input: "$mainImage",
										regex: /(?<=img src=")(.*?)(?=")/g,
									},
								},
							},
						},
						{
							$set: {
								mainImageUrl: {
									$ifNull: ["$mainImageUrl.match", null],
								},
							},
						},
						{
							$project: {
								content: 0,
								publish: 0,
							},
						},
						{
							$lookup: {
								from: "users",
								localField: "author",
								foreignField: "_id",
								as: "author",
								pipeline: [
									{
										$project: {
											_id: 0,
											username: 1,
										},
									},
								],
							},
						},
						{
							$unwind: {
								path: "$author",
							},
						},
					],
					countPosts: [
						{
							$count: "count",
						},
					],
				},
			},
			{
				$unwind: {
					path: "$countPosts",
				},
			},
			{
				$set: {
					countPosts: "$countPosts.count",
				},
			},
		];

		const posts = await Post.aggregate(pipeline);

		res.json({
			success: true,
			message: "Get all posts successfully.",
			data: posts[0],
		});
	}),
];

export const postDetail = [
	asyncHandler(async (req, res) => {
		const { postId } = req.params;

		const pipeline = [
			{
				$match: {
					_id: new Types.ObjectId(`${postId}`),
				},
			},
			{
				$lookup: {
					from: "users",
					localField: "author",
					foreignField: "_id",
					as: "author",
					pipeline: [
						{
							$project: {
								_id: 0,
								username: 1,
							},
						},
					],
				},
			},
			{
				$unwind: {
					path: "$author",
				},
			},
			{
				$set: {
					mainImageUrl: {
						$regexFind: {
							input: "$mainImage",
							regex: /(?<=img src=")(.*?)(?=")/g,
						},
					},
				},
			},
			{
				$set: {
					mainImageUrl: {
						$ifNull: ["$mainImageUrl.match", null],
					},
				},
			},
			{
				$lookup: {
					from: "comments",
					localField: "_id",
					foreignField: "post",
					as: "countComments",
				},
			},
			{
				$set: {
					countComments: {
						$size: "$countComments",
					},
				},
			},
		];

		const post =
			isValidObjectId(postId) && (await Post.aggregate(pipeline));

		post?.length
			? res.json({
					success: true,
					message: "Get post successfully.",
					data: post[0],
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
			optional: {
				options: {
					values: "falsy",
				},
			},
			unescape: true,
			trim: true,
			isLength: {
				options: { min: 0, max: 100 },
				errorMessage: "Title must be less than 100 long.",
			},
		},
		mainImage: {
			trim: true,
			optional: {
				options: {
					values: "falsy",
				},
			},
			isURL: {
				protocols: ["https"],
				errorMessage:
					"Only https protocol is allowed in main image URL",
				bail: true,
			},
			custom: {
				options: url =>
					new Promise((resolve, reject) => {
						const handleCheckMimeType = mimeType => {
							const isValidMimeTypes =
								/(?=(jpeg|png|webp))/g.test(mimeType);

							isValidMimeTypes ? resolve() : reject();
						};

						const handleFetch = url => {
							https
								.request(url, res => {
									res["statusCode"] === 200
										? handleCheckMimeType(
												res.headers?.["content-type"]
										  )
										: reject();
								})
								.on("error", () => reject())
								.end();
						};

						https
							.request(url, res => {
								switch (res["statusCode"]) {
									case 200:
										handleCheckMimeType(
											res.headers?.["content-type"]
										);
										break;
									case 302:
										handleFetch(res.headers?.["location"]);
										break;
									default:
										reject();
								}
							})
							.on("error", () => reject())
							.end();
					}),
				errorMessage: "Main image is not a valid source.",
			},
		},
		content: {
			optional: {
				options: {
					values: "falsy",
				},
			},
			trim: true,
			custom: {
				options: content => {
					const wordCountLimit = 8000;

					const words = content
						.match(/(?<=>)[^<>\n]+(?=<)/g)
						?.join(" ")
						?.replace(/\s/g, "");

					const escapeCount = words?.match(/(?<=)&[\w]+;(?=)/g) ?? [];

					const wordCount =
						words?.replace(/(?<=)&[\w]+;(?=)/g, "") ?? [];

					return (
						escapeCount.length + wordCount.length <= wordCountLimit
					);
				},
				errorMessage: "Content must be less than 8000 long.",
			},
		},
	}),
	validationScheme,
	asyncHandler(async (req, res) => {
		const newPost = new Post({
			...req.data,
			author: req.user.id,
		});

		const post = await newPost.save();

		const { author, ...createdPost } = post._doc;

		res.json({
			success: true,
			data: createdPost,
			message: "Create post successfully.",
		});
	}),
];

export const postUpdate = [
	checkSchema({
		title: {
			unescape: true,
			trim: true,
			isLength: {
				options: { min: 0, max: 100 },
				errorMessage: "Title must be less than 100 long.",
				bail: true,
			},
			notEmpty: {
				if: (_value, { req }) => req.body.publish,
				errorMessage: "Title is required.",
			},
		},
		mainImage: {
			trim: true,
			notEmpty: {
				if: (_url, { req }) => req.body.publish,
				errorMessage: "Main Image is required.",
				bail: true,
			},
			isURL: {
				if: url => url !== "",
				protocols: ["https"],
				errorMessage: "Only https protocol is allowed in image URL",
				bail: true,
			},
			custom: {
				if: url => url !== "",
				options: url =>
					new Promise((resolve, reject) => {
						const handleCheckMimeType = mimeType => {
							const isValidMimeTypes =
								/(?=(jpeg|png|webp))/g.test(mimeType);

							isValidMimeTypes ? resolve() : reject();
						};

						const handleFetch = url => {
							https
								.request(url, res => {
									res["statusCode"] === 200
										? handleCheckMimeType(
												res.headers?.["content-type"]
										  )
										: reject();
								})
								.on("error", () => reject())
								.end();
						};

						https
							.request(url, res => {
								switch (res["statusCode"]) {
									case 200:
										handleCheckMimeType(
											res.headers?.["content-type"]
										);
										break;
									case 302:
										handleFetch(res.headers?.["location"]);
										break;
									default:
										reject();
								}
							})
							.on("error", () => reject())
							.end();
					}),
				errorMessage: "Main image is not a valid source.",
			},
		},
		content: {
			trim: true,
			custom: {
				options: content => {
					const wordCountLimit = 8000;

					const words = content
						.match(/(?<=>)[^<>\n]+(?=<)/g)
						?.join(" ")
						?.replace(/\s/g, "");

					const escapeCount = words?.match(/(?<=)&[\w]+;(?=)/g) ?? [];

					const wordCount =
						words?.replace(/(?<=)&[\w]+;(?=)/g, "") ?? [];

					return (
						escapeCount.length + wordCount.length <= wordCountLimit
					);
				},
				errorMessage: "Content must be less than 8000 long.",
			},
		},
		publish: {
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
			Comment.deleteMany({ post: req.post.id }).exec(),
			req.post.deleteOne(),
		]);

		res.json({
			success: true,
			message: "Delete post successfully.",
		});
	}),
];
