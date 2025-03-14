import express from "express";
import createError from "http-errors";
import morgan from "morgan";
import debug from "debug";
import session from "express-session";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import MongoStore from "connect-mongo";
import { randomBytes } from "node:crypto";

// config
import { mongoose } from "./config/database.js";
import { passport } from "./config/passport.js";

// routes
import { accountRouter } from "./routes/account.js";
import { blogRouter } from "./routes/blog.js";
import { userRouter } from "./routes/user.js";

export const app = express();

app.use((req, res, next) => {
	res.locals.cspNonce = randomBytes(32).toString("base64");
	res.set("Cache-Control", "no-cache=Set-Cookie"); // To avoid the private or sensitive data exchanged within the session through the web browser cache after the session has been closed.
	next();
});

const errorLog = debug("ServerError");
const corsOptions = {
	origin: process.env.ALLOW_CLIENT_ORIGINS.split(","),
	methods: ["GET", "POST", "PATCH", "DELETE"],
	credentials: true,
	allowedHeaders: ["Content-Type", "X-CSRF-TOKEN"],
	maxAge: 3600,
};
const sessionOptions = {
	secret: process.env.SESSION_SECRETS.split(","),
	resave: false,
	saveUninitialized: false, // If the user first send request to the server, at the end of the request and when saveUninitialized is false, the session.req is unmodified then will not be stored in the session store.
	store: MongoStore.create(mongoose.connection),
	name: "id",
	cookie: {
		sameSite: "Lax",
		httpOnly: true,
		secure: process.env.NODE_ENV !== "development",
		maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
	},
};

const helmetOptions = {
	// Strict CSP
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'none'"],
			scriptSrc: [
				(req, res) => `'nonce-${res.locals.cspNonce}'`, // An attacker can't include or run a malicious script
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

app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.use(helmet(helmetOptions));
app.use(session(sessionOptions));
app.use(passport.session());
app.use(morgan(process.env.production ? "common" : "dev"));
app.use(compression());

app.use(express.json());

// session touch
app.use((req, res, next) => {
	const idleTimeout = 2 * 24 * 60 * 60 * 1000; // 48 hours

	const expires = +req.session.cookie.expires;

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
app.use((req, res, next) => {
	next(createError(404, "The endpoint you are looking for cannot be found."));
});

// Errors handler
/* eslint-disable no-unused-vars */
app.use((err, req, res, next) => {
	/* eslint-enable */
	errorLog(err);

	err.status ?? (err = createError(500));

	res.status(err.status).json({
		success: false,
		message: err.message,
	});
});
