const asyncHandler = require("express-async-handler");
const { isValidObjectId } = require("mongoose");

const verifyParamId = asyncHandler((req, res, next) => {
	isValidObjectId(req.params.id)
		? next()
		: res.status(404).json({
				success: false,
				message: "The post cannot be found.",
		  });
});

module.exports = verifyParamId;
