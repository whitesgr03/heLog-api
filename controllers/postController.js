// Modules
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
			notEmpty: {
				if: (_value, { req }) => req.body.publish,
				errorMessage: "Content is required.",
			},
		},
		publish: {
			trim: true,
			toLowerCase: true,
			isBoolean: {
				options: {
					loose: false,
				},
				errorMessage: "The publish must be boolean.",
			},
		},
	}),
	validationScheme,
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
		const { title, mainImage, content, publish } = req.data;

		req.post.title = title;
		req.post.mainImage = mainImage;
		req.post.content = content;
		req.post.publish = publish;

		const post = await req.post.save();

		const { author, ...updatedPost } = post._doc;

		res.json({
			success: true,
			message: "Update post successfully.",
			data: updatedPost,
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
