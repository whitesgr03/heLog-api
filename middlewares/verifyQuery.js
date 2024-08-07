import debug from "debug";
import asyncHandler from "express-async-handler";

const serverLog = debug("Server");

const verifyQuery = asyncHandler((req, res, next) => {
	const obj = req.session?.queries || req.query;

	const { state, code_challenge, code_challenge_method, redirect_url } = obj;

	const handleError = () => {
		serverLog("The request is missing a required parameter.");
		res.render("error");
	};

	state && code_challenge && code_challenge_method && redirect_url
		? next()
		: handleError();
});

export default verifyQuery;
