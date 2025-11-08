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
								httpOnly: process.env.NODE_ENV === "production",
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
export const facebookLogin: RequestHandler[] = [
	(req, res, next) => {
		req.session.referer = req.headers.referer;
		next();
	},
	passport.authenticate("facebook"),
];
export const facebookRedirect: RequestHandler[] = [
	(req, res, next) => {
		const authenticateCb: AuthenticateCallback = (err, user) => {
			const redirect_origin =
				process.env
					.ALLOW_CLIENT_ORIGINS!.split(",")
					.find(origin => `${origin}/` === req.session.referer) ??
				process.env.HELOG_URL!;

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
										process.env.NODE_ENV === "production",
									maxAge:
										req.session.cookie.originalMaxAge ??
										Date.now(),
								}
							)
							.redirect(redirect_origin);
				  })
				: res.redirect(redirect_origin);
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
	const { redirect_uri = null, theme = true } = req.query;

	const uri = process.env
		.ALLOW_CLIENT_ORIGINS!.split(",")
		.find(origin => origin === redirect_uri);

	if (uri) {
		res.render("userSignIn", {
			redirect_uri,
			theme,
		});
	} else {
		res.status(400).json({
			success: false,
			message: "Redirect uri mismatch.",
		});
	}
};
