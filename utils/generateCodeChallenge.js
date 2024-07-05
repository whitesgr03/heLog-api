import crypto from "node:crypto";

const generateCodeChallenge = code_verifier =>
	crypto
		.createHash("sha256")
		.update(code_verifier)
		.digest("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

export default generateCodeChallenge;
