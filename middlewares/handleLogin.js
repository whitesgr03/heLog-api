import passport from "../config/passport.js";
import asyncHandler from "express-async-handler";
import Csrf from "csrf";

const handleLogin = asyncHandler((req, res, next) => {
	const authenticateFn = passport.authenticate(
		"local",
		async (err, user, failInfo) => {
			err && next(err);
			const {
				state,
				code_challenge,
				code_challenge_method,
				redirect_url,
				darkTheme,
			} = req.query;
			const queries =
				`state=${state}` +
				`&code_challenge=${code_challenge}` +
				`&code_challenge_method=${code_challenge_method}` +
				`&redirect_url=${redirect_url}` +
				`&darkTheme=${darkTheme}`;

			const csrf = new Csrf();
			const secret = await csrf.secret();
			req.session.csrf = secret;

			failInfo &&
				res.render("login", {
					user: req.data,
					queries,
					csrfToken: csrf.create(secret),
					inputErrors: {
						email: { msg: failInfo },
					},
				});
			user &&
				req.login(user, () => {
					res.redirect(`/auth/code?${queries}`);
				});
		}
	);
	authenticateFn(req, res, next);
});

export default handleLogin;
