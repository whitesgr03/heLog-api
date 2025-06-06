// Modules
import { Request } from "express";
import asyncHandler from "express-async-handler";
import { body } from "express-validator";
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
	body("title")
		.trim()
		.unescape()
		.isLength({ min: 0, max: 100 })
		.withMessage("Title must be less than 100 long.")
		.escape(),
	body("mainImage")
		.trim()
		.if(value => value !== "")
		.isURL({
			protocols: ["https"],
		})
		.withMessage("Main image is not a valid HTTP URL."),
	body("content")
		.trim()
		.custom(content => {
			const limit = 8000;

			const characterCountWithoutSpaces = content.replace(
				/(<.+?>|\s|&nbsp;)/g,
				""
			);

			const HTML_EntityCount =
				characterCountWithoutSpaces?.match(/(?<=)&[\w]+;(?=)/g)
					?.length ?? 0;

			const characterCount =
				characterCountWithoutSpaces?.replace(/(?<=)&[\w]+;(?=)/g, "")
					?.length ?? 0;

			return HTML_EntityCount + characterCount <= limit;
		})
		.withMessage("Content must be less than 8000 long."),
	validationScheme,
	asyncHandler(async (req, res) => {
		const newPost = new Post({
			...req.data,
			author: req.user!.id,
		});

		await newPost.save();

		const createdPost = await Post.findById(newPost._id, { author: 0 });

		res.json({
			success: true,
			data: createdPost,
			message: "Create post successfully.",
		});
	}),
];

export const postUpdate = [
	body("title")
		.trim()
		.if((_value, { req }) => req.body.publish)
		.notEmpty()
		.withMessage("Title is required.")
		.bail()
		.unescape()
		.isLength({ min: 0, max: 100 })
		.withMessage("Title must be less than 100 long.")
		.escape(),
	body("mainImage")
		.trim()
		.if((_value, { req }) => req.body.publish)
		.notEmpty()
		.withMessage("Main image is required.")
		.bail()
		.if(value => value !== "")
		.isURL({
			protocols: ["https"],
		})
		.withMessage("Main image is not a valid HTTP URL."),
	body("content")
		.trim()
		.if((_value, { req }) => req.body.publish)
		.notEmpty()
		.withMessage("Content is required.")
		.bail()
		.custom(content => {
			const limit = 8000;

			const characterCountWithoutSpaces = content.replace(
				/(<.+?>|\s|&nbsp;)/g,
				""
			);

			const HTML_EntityCount =
				characterCountWithoutSpaces?.match(/(?<=)&[\w]+;(?=)/g)
					?.length ?? 0;

			const characterCount =
				characterCountWithoutSpaces?.replace(/(?<=)&[\w]+;(?=)/g, "")
					?.length ?? 0;

			return HTML_EntityCount + characterCount <= limit;
		})
		.withMessage("Content must be less than 8000 long."),
	body("publish")
		.trim()
		.toLowerCase()
		.notEmpty()
		.withMessage("Publish is required.")
		.bail()
		.isBoolean({
			loose: false,
		})
		.withMessage("The publish must be boolean."),
	validationScheme,
	asyncHandler(async (req, res, next) => {
		const { postId } = req.params;

		const post =
			isValidObjectId(postId) && (await Post.findById(postId).exec());

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
		const user = await User.findById(req.user!.id, { isAdmin: 1 }).exec();

		user?.isAdmin || user?.id.toString() === req.post.author._id.toString()
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
			isValidObjectId(postId) && (await Post.findById(postId).exec());

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
		const user = await User.findById(req.user!.id, { isAdmin: 1 }).exec();

		user?.isAdmin || user?.id.toString() === req.post.author._id.toString()
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
