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
					message: "The request is missing a required parameter.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		isValidObjectId(req.params[`${type}Id`])
			? next()
			: res.status(400).json({
					success: false,
					message: 'The parameter is invalid object ID.'
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const models = {
			post: Post,
			comment: Comment,
			reply: Reply,
		};

		const data = await models[`${type}`]
			.findById(req.params[`${type}Id`])
			.populate("author", {
				_id: 1,
			})
			.exec();

		const setLocals = () => {
			req[type] = { authorId: data._id };
			next();
		};

		data
			? setLocals()
			: res.status(404).json({
					success: false,
					message: `The ${type} could not be found.`,
			  });
	}),
];

export default verifyId;
