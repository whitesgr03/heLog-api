const asyncHandler = require("express-async-handler");

const User = require("../models/user");
const Comment = require("../models/comment");

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

// 雙重 permission

module.exports = verifyPermission;
