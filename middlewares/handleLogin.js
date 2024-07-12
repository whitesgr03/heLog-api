import passport from "../config/passport.js";
import asyncHandler from "express-async-handler";

const handleLogin = asyncHandler((req, res, next) => {
	const authenticateFn = passport.authenticate(
		"local",
		(err, user, failInfo) => {
			const {
				state,
				code_challenge,
				code_challenge_method,
				redirect_url,
				darkTheme,
			} = req.query;
			err && next(err);
			failInfo &&
				res.render("login", {
					user: req.data,
					inputErrors: {
						email: { msg: failInfo },
					},
				});
			user &&
				req.login(user, () => {
					res.redirect(
						"/auth/code" +
							`?state=${state}` +
							`&code_challenge=${code_challenge}` +
							`&code_challenge_method=${code_challenge_method}` +
							`&redirect_url=${redirect_url}` +
							`&darkTheme=${darkTheme}`
					);
				});
		}
	);
	authenticateFn(req, res, next);
});

export default handleLogin;
