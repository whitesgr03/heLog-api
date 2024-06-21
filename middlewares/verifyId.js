const asyncHandler = require("express-async-handler");
const { isValidObjectId } = require("mongoose");

const verifyId = name =>
	asyncHandler(async (req, res, next) => {
		isValidObjectId(req.params[`${name}Id`])
			? next()
			: res.status(404).json({
					success: false,
					message: `The ${name} could not be found.`,
			  });
	});

module.exports = verifyId;
