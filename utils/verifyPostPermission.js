const asyncHandler = require("express-async-handler");

const User = require("../models/user");

const verifyPostPermission = asyncHandler(async (req, res, next) => {
	const user = User.findById(req.user.id).exec();

	user.isAdmin
		? next()
		: res.status(403).json({
				success: false,
				message: "The request requires higher privileges than provided by the access token.",
		  });
});

module.exports = verifyPostPermission;
