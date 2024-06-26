import asyncHandler from "express-async-handler";

import User from "../models/user.js";
import Comment from "../models/comment.js";

const verifyPermission = asyncHandler(async (req, res, next) => {
	const { commentId } = req.params;
	const { id } = req.user;

	const user = await User.findById(id).exec();

	const comment =
		commentId &&
		(await Comment.findById(commentId).populate("author").exec());

	const isValidPermission = comment ? comment.author.id === id : user.isAdmin;

	isValidPermission
		? next()
		: res.status(403).json({
				success: false,
				message:
					"The request requires higher privileges than provided by the access token.",
		  });
});

export default verifyPermission;
