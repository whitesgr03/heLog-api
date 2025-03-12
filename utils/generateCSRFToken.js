import { randomBytes, createHmac } from "node:crypto";

export const generateCSRFToken = sessionId => {
	const secret = process.env.CSRF_SECRETS;
	const randomValue = randomBytes(64).toString("hex");
	const message = `${sessionId.length}!${sessionId}!${randomValue.length}!${randomValue}`;
	const hmac = createHmac("sha256", secret).update(message).digest("hex");

	return hmac + "." + randomValue;
};
