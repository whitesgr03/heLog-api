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

		const [posts, postsCount] = await Promise.all([
			Post.find(
				{ publish: true },
				{
					content: 0,
					publish: 0,
				},
				{
					skip: Number(skip),
					limit: 100,
					sort: {
						createdAt: -1,
						_id: -1,
					},
					populate: {
						path: "author",
						select: {
							_id: 0,
							username: 1,
						},
					},
				}
			).exec(),
			Post.countDocuments(),
		]);

		res.json({
			success: true,
			message: "Get all posts successfully.",
			data: { posts, postsCount },
		});
	}),
];

export const postDetail = [
	asyncHandler(async (req, res) => {
		const { postId } = req.params;

		const post =
			isValidObjectId(postId) &&
			(await Post.findOne(
				{
					_id: new Types.ObjectId(`${postId}`),
					publish: true,
				},
				{
					publish: 0,
				}
			)
				.populate("author", {
					_id: 0,
					username: 1,
				})
				.exec());

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
			trim: true,
			unescape: true,
			isLength: {
				options: { min: 0, max: 100 },
				errorMessage: "Title must be less than 100 long.",
			},
			escape: true,
		},
		mainImage: {
			trim: true,
			isURL: {
				if: value => value !== "",
				options: {
					protocols: ["https"],
				},
				errorMessage: "Main image is not a valid HTTP URL.",
			},
		},
		content: {
			trim: true,
			custom: {
				options: content => {
					const limit = 8000;

					const characterCountWithoutSpaces = content.replace(
						/(<.+?>|\s|&nbsp;)/g,
						""
					);

					const HTML_EntityCount =
						characterCountWithoutSpaces?.match(/(?<=)&[\w]+;(?=)/g)
							?.length ?? 0;

					const characterCount =
						characterCountWithoutSpaces?.replace(
							/(?<=)&[\w]+;(?=)/g,
							""
						)?.length ?? 0;

					return HTML_EntityCount + characterCount <= limit;
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
			trim: true,
			unescape: true,
			isLength: {
				options: { min: 0, max: 100 },
				errorMessage: "Title must be less than 100 long.",
				bail: true,
			},
			escape: true,
			notEmpty: {
				if: (_value, { req }) => req.body.publish,
				errorMessage: "Title is required.",
			},
		},
		mainImage: {
			trim: true,
			notEmpty: {
				if: (_url, { req }) => req.body.publish,
				errorMessage: "Main image is required.",
				bail: true,
			},
			isURL: {
				if: value => value !== "",
				options: {
					protocols: ["https"],
				},
				errorMessage: "Main image is not a valid HTTP URL.",
			},
		},
		content: {
			trim: true,
			custom: {
				options: content => {
					const limit = 8000;

					const characterCountWithoutSpaces = content.replace(
						/(<.+?>|\s|&nbsp;)/g,
						""
					);

					const HTML_EntityCount =
						characterCountWithoutSpaces?.match(/(?<=)&[\w]+;(?=)/g)
							?.length ?? 0;

					const characterCount =
						characterCountWithoutSpaces?.replace(
							/(?<=)&[\w]+;(?=)/g,
							""
						)?.length ?? 0;

					return HTML_EntityCount + characterCount <= limit;
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
