import asyncHandler from "express-async-handler";

const verifyScope = scope =>
	asyncHandler(async (req, res, next) => {
		req.payload.scope.split(" ").includes(scope)
			? next()
			: res.status(401).json({
					success: false,
					message: "The scope provided is invalid.",
			  });
	});

export default verifyScope;
