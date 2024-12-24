export const authenticate = (req, res, next) => {
	req.isAuthenticated()
		? next()
		: res.status(404).json({
				success: false,
				message: "User could not been found.",
		  });
};
