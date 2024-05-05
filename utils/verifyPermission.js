const asyncHandler = require("express-async-handler");

const Post = require("../models/post");
const User = require("../models/user");

const verifyPermission = asyncHandler(async (req, res, next) => {
	const { id } = req.user;

	const [user, post] = await Promise.all([
		User.findById(id).exec(),
		Post.findById(req.params.id).populate("author").exec(),
	]);

	post && (user.isAdmin || post.author.id === id)
		? next()
		: res.status(404).json({
				success: false,
				message: "The post cannot be found.",
		  });
});

module.exports = verifyPermission;
