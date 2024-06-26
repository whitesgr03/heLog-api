import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";

const verifyToken = asyncHandler(async (req, res, next) => {
	const token = req.headers.authorization;

	const handleErrorMessages = () => {
		res.status(401).json({
			success: false,
			message:
				"The access token provided is expired, revoked, malformed, or invalid for other reasons.",
		});
	};

	token
		? jwt.verify(
				token.split(" ")[1],
				process.env.PRIVATE_KEY,
				async (err, payload) => {
					const setUserId = async () => {
						req.user = {
							id: payload.id,
						};
						next();
					};
					err ? handleErrorMessages() : setUserId();
				}
		  )
		: handleErrorMessages();
});

export default verifyToken;
