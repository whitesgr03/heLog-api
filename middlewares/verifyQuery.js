import asyncHandler from "express-async-handler";

const verifyQuery = asyncHandler((req, res, next) => {
	const { state, code_challenge, code_challenge_method, scope } = req.query;

	state && code_challenge && code_challenge_method && scope
		? next()
		: res.render("error", {
				message: "The request is missing a required parameter.",
		  });
});

export default verifyQuery;
