import asyncHandler from "express-async-handler";

const verifyRedirectUrl = asyncHandler((req, res, next) => {
	const { redirect_url } = req.query;
    JSON.parse(process.env.ALLOW_CLIENT_ORIGINS).includes(redirect_url)
		? next()
		: res.render("error", {
				message: "The redirect_url provided is invalid.",
		  });
});

export default verifyRedirectUrl;
