import asyncHandler from "express-async-handler";
import { isValidObjectId } from "mongoose";

import Post from "../models/post.js";
import Comment from "../models/comment.js";
import Reply from "../models/reply.js";

const verifyId = type => [
	asyncHandler(async (req, res, next) => {
		req.params[`${type}Id`]
			? next()
			: res.status(400).json({
					success: false,
					message: `The parameter is missing ${type}.`,
			  });
	}),
	asyncHandler(async (req, res, next) => {
		isValidObjectId(req.params[`${type}Id`])
			? next()
			: res.status(400).json({
					success: false,
					message: `The ${type} is invalid object id.`,
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const Models = {
			post: Post,
			comment: Comment,
			reply: Reply,
		};

		const document = await Models[`${type}`]
			.findById(req.params[`${type}Id`])
			.populate("author", {
				name: 1,
			})
			.exec();

		const setLocals = () => {
			req[type] = document;
			next();
		};

		document
			? setLocals()
			: res.status(404).json({
					success: false,
					message: `The ${type} could not be found.`,
			  });
	}),
];

export default verifyId;
