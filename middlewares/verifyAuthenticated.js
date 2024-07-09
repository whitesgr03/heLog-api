import asyncHandler from "express-async-handler";

const verifyAuthenticated = asyncHandler((req, res, next) => {
	!req.isAuthenticated() ? next() : res.redirect(process.env.REDIRECT_URL);
});

export default verifyAuthenticated;
