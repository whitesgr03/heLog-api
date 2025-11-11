import passport, { AuthenticateCallback } from "passport";

import { RequestHandler } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { validationCSRF } from "../middlewares/validationCSRF.js";

import { generateCSRFToken } from "../utils/generateCSRFToken.js";

export const googleLogin: RequestHandler = passport.authenticate("google");
export const googleRedirect: RequestHandler[] = [
	(req, res, next) => {
		const authenticateCb: AuthenticateCallback = (err, user) => {
			err && next(err);
			user &&
				req.login(user, () => {
					res.set("Cache-Control", "no-cache=Set-Cookie") // To avoid the private or sensitive data exchanged within the session through the web browser cache after the session has been closed.
						.cookie(
							process.env.NODE_ENV === "production"
								? "__Secure-token"
								: "token",
							generateCSRFToken(req.sessionID),
							{
								sameSite: "strict",
								httpOnly: false, // Front-end need to access __Secure-token cookie
								secure: process.env.NODE_ENV === "production",
								domain: process.env.DOMAIN ?? "",
								maxAge:
									req.session.cookie.originalMaxAge ??
									Date.now(),
							}
						)
						.redirect(process.env.HELOG_URL!);
				});
		};

		const authenticateFn = passport.authenticate("google", authenticateCb);
		authenticateFn(req, res, next);
	},
];
export const facebookLogin: RequestHandler = passport.authenticate("facebook");
export const facebookRedirect: RequestHandler[] = [
	(req, res, next) => {
		if (req.query.code) {
			next();
		} else {
			res.redirect("/account/login");
		}
	},
	(req, res, next) => {
		const authenticateCb: AuthenticateCallback = (err, user) => {
			err && next(err);
			user &&
				req.login(user, () => {
					res.set("Cache-Control", "no-cache=Set-Cookie") // To avoid the private or sensitive data exchanged within the session through the web browser cache after the session has been closed.
						.cookie(
							process.env.NODE_ENV === "production"
								? "__Secure-token"
								: "token",
							generateCSRFToken(req.sessionID),
							{
								sameSite: "strict",
								httpOnly: false, // Front-end need to access __Secure-token cookie
								domain: process.env.DOMAIN ?? "",
								secure: process.env.NODE_ENV === "production",
								maxAge:
									req.session.cookie.originalMaxAge ??
									Date.now(),
							}
						)
						.redirect(process.env.HELOG_URL!);
				});
		};
		const authenticateFn = passport.authenticate(
			"facebook",
			authenticateCb
		);
		authenticateFn(req, res, next);
	},
];
export const userLogout: RequestHandler[] = [
	authenticate,
	validationCSRF,
	(req, res) => {
		req.session.destroy(() =>
			res.set("Clear-Site-Data", ["cache", "cookies", "storage"]).json({
				success: true,
				message: "User logout successfully.",
			})
		);
	},
];

export const login: RequestHandler = (req, res) => {
	res.render("userSignIn");
};
