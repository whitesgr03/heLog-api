import passport from "passport";

import { authenticate } from "../middlewares/authenticate.js";

export const googleLogin = [passport.authenticate("google")];
export const googleRedirect = [
	(req, res, next) => {
		const authenticateFn = passport.authenticate("google", (err, user) => {
			const redirect_origin =
				process.env.ALLOW_CLIENT_ORIGINS.split(",").find(
					origin => `${origin}/` === req.session.referer
				) ?? process.env.HELOG_URL;

			err && next(err);
			user
				? req.login(user, () => res.redirect(redirect_origin))
				: res.redirect(redirect_origin);
		});
		authenticateFn(req, res, next);
	},
];
export const facebookLogin = [passport.authenticate("facebook")];
export const facebookRedirect = [
	(req, res, next) => {
		const authenticateFn = passport.authenticate(
			"facebook",
			(err, user) => {
				const redirect_origin =
					process.env.ALLOW_CLIENT_ORIGINS.split(",").find(
						origin => `${origin}/` === req.session.referer
					) ?? process.env.HELOG_URL;

				delete req.session.oauth2;
				delete req.session.referer;

				err && next(err);
				user
					? req.login(user, () => res.redirect(redirect_origin))
					: res.redirect(redirect_origin);
			}
		);
		authenticateFn(req, res, next);
	},
];
export const userLogout = [
	authenticate,
	(req, res, next) => {
		req.logout(err =>
			err
				? next(err)
				: res.json({
						success: true,
						message: "User logout successfully.",
				  })
		);
	},
];
