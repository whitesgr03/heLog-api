import asyncHandler from "express-async-handler";

import User from "../models/user.js";

const verifyPermission = type =>
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, { isAdmin: 1 }).exec();

		user.isAdmin || user._id === req[type].author._id
			? next()
			: res.status(403).json({
					success: false,
					message: "This request requires higher permissions.",
			  });
	});

export default verifyPermission;
