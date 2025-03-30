import passport from "passport";

import { authenticate } from "../middlewares/authenticate.js";
import { validationCSRF } from "../middlewares/validationCSRF.js";

import { generateCSRFToken } from "../utils/generateCSRFToken.js";

export const googleLogin = [
	(req, res, next) => {
		req.session.referer = req.headers.referer;
		next();
	},
	passport.authenticate("google"),
];
export const googleRedirect = [
	(req, res, next) => {
		const authenticateFn = passport.authenticate("google", (err, user) => {
			const redirect_origin =
				process.env.ALLOW_CLIENT_ORIGINS.split(",").find(
					origin => `${origin}/` === req.session.referer
				) ?? process.env.HELOG_URL;

			delete req.session.referer;

			err && next(err);
			user
				? req.login(user, () => {
						res.set("Cache-Control", "no-cache=Set-Cookie") // To avoid the private or sensitive data exchanged within the session through the web browser cache after the session has been closed.
							.cookie(
								process.env.NODE_ENV === "production"
									? "__Secure-token"
									: "token",
								generateCSRFToken(req.sessionID),
								{
									sameSite: "strict",
									httpOnly: false,
									secure:
										process.env.NODE_ENV === "production",
									domain: process.env.DOMAIN ?? "",
									maxAge: req.session.cookie.originalMaxAge,
								}
							)
							.redirect(redirect_origin);
				  })
				: res.redirect(redirect_origin);
		});
		authenticateFn(req, res, next);
	},
];
export const facebookLogin = [
	(req, res, next) => {
		req.session.referer = req.headers.referer;
		next();
	},
	passport.authenticate("facebook"),
];
export const facebookRedirect = [
	(req, res, next) => {
		const authenticateFn = passport.authenticate(
			"facebook",
			(err, user) => {
				const redirect_origin =
					process.env.ALLOW_CLIENT_ORIGINS.split(",").find(
						origin => `${origin}/` === req.session.referer
					) ?? process.env.HELOG_URL;

				delete req.session.referer;

				err && next(err);
				user
					? req.login(user, () => {
							res.set("Cache-Control", "no-cache=Set-Cookie") // To avoid the private or sensitive data exchanged within the session through the web browser cache after the session has been closed.
								.cookie(
									process.env.NODE_ENV === "production"
										? "__Secure-token"
										: "token",
									generateCSRFToken(req.sessionID),
									{
										sameSite: "strict",
										httpOnly: false,
										domain: process.env.DOMAIN ?? "",
										secure:
											process.env.NODE_ENV ===
											"production",
										maxAge: req.session.cookie
											.originalMaxAge,
									}
								)
								.redirect(redirect_origin);
					  })
					: res.redirect(redirect_origin);
			}
		);
		authenticateFn(req, res, next);
	},
];
export const userLogout = [
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
