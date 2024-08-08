import passport from "../config/passport.js";
import asyncHandler from "express-async-handler";
import Csrf from "csrf";

const handleLogin = asyncHandler((req, res, next) => {
	const authenticateFn = passport.authenticate(
		"local",
		async (err, user, failInfo) => {
			const handleError = async () => {
				const csrf = new Csrf();
				const secret = await csrf.secret();
				req.session.csrf = secret;
				res.render("login", {
					user: req.data,
					csrfToken: csrf.create(secret),
					inputErrors: {
						email: { msg: failInfo },
					},
				});
			};

			const handleUserLogin = () => {
				const queries = req.session.queries;
				const cb = () => {
					req.session.queries = queries;
					res.redirect(`/auth/code`);
				};
				req.login(user, cb);
			};

			err && next(err);
			failInfo && (await handleError());
			user && handleUserLogin();
		}
	);
	authenticateFn(req, res, next);
});

export default handleLogin;
