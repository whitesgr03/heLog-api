import express, {
	ErrorRequestHandler,
	RequestHandler,
	Response,
} from "express";
import createError from "http-errors";
import morgan from "morgan";
import debug from "debug";
import session, { SessionOptions } from "express-session";
import cors from "cors";
import sessionStore from "connect-mongo";
import { randomBytes } from "node:crypto";
import { rateLimit } from "express-rate-limit";
// import ratelimitStore from "rate-limit-mongo";
import mongoose from "mongoose";
import helmet, { HelmetOptions } from "helmet";

// config
import { passport } from "./config/passport.js";

// routes
import { accountRouter } from "./routes/account.js";
import { blogRouter } from "./routes/blog.js";
import { userRouter } from "./routes/user.js";

export const app = express();

declare global {
	namespace Express {
		interface Request {
			data?: any;
			post?: any;
			comment?: any;
			reply?: any;
			deletedByAdmin?: any;
		}
	}
}

declare module "express-session" {
	interface SessionData {
		referer?: string;
	}
}

app.get("/favicon.ico", (req, res) => {
	res.status(204);
});
app.use(((req, res, next) => {
	res.locals.cspNonce = randomBytes(32).toString("base64");
	next();
}) as RequestHandler);

const errorLog = debug("ServerError");
const corsOptions = {
	origin: process.env.ALLOW_CLIENT_ORIGINS?.split(","),
	methods: ["GET", "POST", "PATCH", "DELETE"],
	credentials: true,
	allowedHeaders: ["Content-Type", "X-CSRF-TOKEN"],
	maxAge: 10,
};
const sessionOptions: SessionOptions = {
	secret: process.env.SESSION_SECRETS?.split(",") ?? "",
	resave: false,
	saveUninitialized: false, // If the user first send request to the server, at the end of the request and when saveUninitialized is false, the session.req is unmodified then will not be stored in the session store.
	store: sessionStore.create({
		client: mongoose.connection.getClient(),
	}),
	name: process.env.NODE_ENV === "production" ? "__Secure-id" : "id",
	cookie: {
		sameSite: "strict",
		domain: process.env.DOMAIN ?? "",
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
	},
};

const helmetOptions: HelmetOptions = {
	xFrameOptions: { action: "deny" }, // To avoid clickjacking attacks, by ensuring that their content is not embedded into other sites.
	strictTransportSecurity: {
		//  It should only be accessed using HTTPS, instead of using HTTP.
		maxAge: 63072000,
		preload: true,
	},
	crossOriginEmbedderPolicy: true, // A document can only load resources from the same origin.
	crossOriginResourcePolicy: { policy: "same-site" }, // Limit current resource loading to the site and sub-domains only.
	contentSecurityPolicy: {
		// Strict CSP
		directives: {
			defaultSrc: ["'none'"],
			scriptSrc: [
				(req, res) => `'nonce-${(res as Response).locals.cspNonce}'`, // An attacker can't include or run a malicious script
				"'strict-dynamic'", // The strict-dynamic tells the browser to trust those script blocks which has either the correct hash or nonce
				"https:", // A fallback for earlier versions of Safari
				"'unsafe-inline'", // A fallback for very old browser versions (4+ years)
			],
			objectSrc: ["'none'"], // Disable dangerous plugins like Flash
			baseUri: ["'none'"], // Block the injection of <base> tags
			frameAncestors: ["'none'"], // To prevent all framing of your content
			connectSrc: ["'self'"], // AJAX from the same origin only
			imgSrc: ["'self'"], // mages from the same origin only
			styleSrc: ["'self'"], // CSS from the same origin only
		},
	},
};
const rateLimitOption = {
	windowMs: 10 * 30 * 1000, // 10 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
};

app.set("trust proxy", 1);

process.env.NODE_ENV === "production" && app.use(rateLimit(rateLimitOption));
app.use(cors(corsOptions));
app.use(helmet(helmetOptions));
app.use(session(sessionOptions));
app.use(passport.session());
app.use(morgan(process.env.production ? "common" : "dev"));

app.use(express.json());

// session touch
app.use((req, res, next) => {
	const idleTimeout = 2 * 24 * 60 * 60 * 1000; // 48 hours

	const expires = req.session.cookie.expires?.getTime() ?? Date.now();

	req.user &&
		(req.session.cookie.maxAge =
			Date.now() + idleTimeout > expires
				? expires - Date.now()
				: idleTimeout);

	next();
});

app.use("/account", accountRouter);
app.use("/user", userRouter);
app.use("/blog", blogRouter);

// Unknown routes handler
app.use(((req, res, next) => {
	next(createError(404, "The endpoint you are looking for cannot be found."));
}) as RequestHandler);

// Errors handler
/* eslint-disable no-unused-vars */

app.use(((err, req, res, next) => {
	/* eslint-enable */
	errorLog(err);
	errorLog(err.status);
	errorLog(err.message);

	const serverError = createError(500);

	res.status(serverError.status).json({
		success: false,
		message: "The server encountered an unexpected condition.",
	});
}) as ErrorRequestHandler);
