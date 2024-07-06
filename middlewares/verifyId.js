import asyncHandler from "express-async-handler";
import { isValidObjectId } from "mongoose";
import Post from "../models/post.js";
import Comment from "../models/comment.js";

const verifyId = name => [
	asyncHandler(async (req, res, next) => {
		req.params[`${name}Id`]
			? next()
			: res.status(404).json({
					success: false,
					message: "The request is missing a required parameter.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		isValidObjectId(req.params[`${name}Id`])
			? next()
			: res.status(404).json({
					success: false,
					message: `The ${name} could not be found.`,
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const Model = name === "post" ? Post : Comment;

		(await Model.findById(req.params[`${name}Id`]).exec())
			? next()
			: res.status(404).json({
					success: false,
					message: `The ${name} could not be found.`,
			  });
	}),
];

export default verifyId;
