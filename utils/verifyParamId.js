const asyncHandler = require("express-async-handler");
const { isValidObjectId } = require("mongoose");

const verifyParamId = asyncHandler((req, res, next) => {
	const { postId, commentId } = req.params;

	const isValidPostId = isValidObjectId(postId);
	const isValidCommentId = isValidObjectId(commentId);

	const isValidParamId = commentId
		? isValidPostId && isValidCommentId
		: isValidPostId;

	isValidParamId
		? next()
		: res.status(404).json({
				success: false,
				message: !isValidPostId
					? "The post cannot be found."
					: !isValidCommentId && "The comment cannot be found.",
		  });
});

module.exports = verifyParamId;
