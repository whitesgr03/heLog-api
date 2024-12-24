import passport from "../config/passport.js";

import { authenticate } from "../middlewares/authenticate.js";

export const googleLogin = [
	(req, res, next) => {
		req.session.oauth2 = true;
		next();
	},
	passport.authenticate("google"),
];
export const googleRedirect = [
	(req, res, next) => {
		req.session.oauth2 ? next() : res.redirect("account/login/google");
	},
	(req, res, next) => {
		const authenticateFn = passport.authenticate(
			"google",
			(err, user, { message }) => {
				delete req.session.oauth2;

				err && next(err);
				message && res.redirect(process.env.HELOG_URL);
				user &&
					req.login(user, () => res.redirect(process.env.HELOG_URL));
			}
		);
		authenticateFn(req, res, next);
	},
];
export const facebookLogin = [
	(req, res, next) => {
		req.session.oauth2 = true;
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
			(err, user, { message }) => {
				console.log(message);
				delete req.session.oauth2;

				err && next(err);
				message && res.redirect(process.env.HELOG_URL);
				user &&
					req.login(user, () => res.redirect(process.env.HELOG_URL));
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
