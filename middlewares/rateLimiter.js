import rateLimit from "express-rate-limit";
import debug from "debug";
const rateLimiterLog = debug("RateLimiter");

const rateLimiter = rateLimit({
	windowMs: 24 * 60 * 60 * 1000, // 24 hrs in milliseconds
	max: 200,
	message: (req, res) => {
		rateLimiterLog("limit ip:", req.ip, "for path:", req.path);
		const message = "You have sent too many requests in 24 hrs limit!";
		const path = req.path.split("/")[2];

		const handleError = () => {
			rateLimiterLog(message);
			res.render("error");
		};
		(path && path === "login") || path === "register"
			? handleError()
			: res.json({
					success: false,
					message,
			  });
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export default rateLimiter;
