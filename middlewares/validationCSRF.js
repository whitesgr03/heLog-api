import { createHmac } from "node:crypto";

export const validationCSRF = [
	(req, res, next) => {
		req.headers["x-csrf-token"]?.split(".").length === 2
			? next()
			: res.status(403).json({
					success: false,
					message: "CSRF custom header is invalid.",
			  });
	},
	(req, res, next) => {
		const [token, randomValue] = req.headers["x-csrf-token"].split(".");

		const secret = process.env.CSRF_SECRETS;

		const message = `${req.sessionID.length}!${req.sessionID}!${randomValue.length}!${randomValue}`;
		const hmac = createHmac("sha256", secret).update(message).digest("hex");

		hmac === token
			? next()
			: res.status(403).json({
					success: false,
					message: "CSRF token mismatch.",
			  });
	},
];
