import asyncHandler from "express-async-handler";
import { isValidObjectId } from "mongoose";

const verifyId = name =>
	asyncHandler(async (req, res, next) => {
		isValidObjectId(req.params[`${name}Id`])
			? next()
			: res.status(404).json({
					success: false,
					message: `The ${name} could not be found.`,
			  });
	});

export default verifyId;
