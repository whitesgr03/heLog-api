const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");

const verifyToken = asyncHandler(async (req, res, next) => {
	const token = req.headers.authorization;

	const handleErrorMessages = () => {
		res.status(401).json({
			success: false,
			message:
				"Please sign in to your account to make authentication successful.",
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

module.exports = verifyToken;
