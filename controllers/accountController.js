import passport from "passport";
import { randomBytes, createHmac } from "node:crypto";

import { authenticate } from "../middlewares/authenticate.js";

const generateCSRFToken = sessionId => {
	const secret = process.env.CSRF_SECRETS;
	const randomValue = randomBytes(64).toString("hex");
	const message = `${sessionId.length}!${sessionId}!${randomValue.length}!${randomValue}`;
	const hmac = createHmac("sha256", secret).update(message).digest("hex");

	return hmac + "." + randomValue;
};

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
				? req.login(user, () =>
						res
							.cookie("token", generateCSRFToken(req.sessionID), {
								sameSite: "strict",
								httpOnly: false,
								secure: true,
								maxAge: req.session.cookie.originalMaxAge,
							})
							.redirect(redirect_origin)
				  )
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

				err && next(err);
				user
					? req.login(user, () =>
							res
								.cookie(
									"token",
									generateCSRFToken(req.sessionID),
									{
										sameSite: "strict",
										httpOnly: false,
										secure: true,
										maxAge: req.session.cookie
											.originalMaxAge,
									}
								)
								.redirect(redirect_origin)
					  )
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
