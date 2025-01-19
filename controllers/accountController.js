import passport from "../config/passport.js";

import { authenticate } from "../middlewares/authenticate.js";

export const googleLogin = [
	(req, res, next) => {
		req.session.oauth2 = true;
		req.session.referer = req.headers.referer;
		next();
	},
	passport.authenticate("google"),
];
export const googleRedirect = [
	(req, res, next) => {
		req.session.oauth2 ? next() : res.redirect("account/login/google");
	},
	(req, res, next) => {
		const authenticateFn = passport.authenticate("google", (err, user) => {
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
		});
		authenticateFn(req, res, next);
	},
];
export const facebookLogin = [
	(req, res, next) => {
		req.session.oauth2 = true;
		req.session.referer = req.headers.referer;
		next();
	},

	passport.authenticate("facebook"),
];
export const facebookRedirect = [
	(req, res, next) => {
		req.session.oauth2 ? next() : res.redirect("account/login/facebook");
	},
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
