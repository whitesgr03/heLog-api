import asyncHandler from "express-async-handler";

const verifyQuery = asyncHandler((req, res, next) => {
	const {
		state,
		code_challenge,
		code_challenge_method,
		redirect_url,
	} = req.query;
	state && code_challenge && code_challenge_method  && redirect_url
		? next()
		: res.render("error", {
				message: "The request is missing a required parameter.",
		  });
});

export default verifyQuery;
