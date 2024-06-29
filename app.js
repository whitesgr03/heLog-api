import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import express from "express";
import createError from "http-errors";
import morgan from "morgan";
import debug from "debug";
import MongoStore from "connect-mongo";
import session from "express-session";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

// config
import passport from "./config/passport.js";
import db from "./config/database.js";

// middleware
import rateLimiter from "./middlewares/rateLimiter.js";

// routes
import accountRouter from "./routes/account.js";
import blogRouter from "./routes/blog.js";

const app = express();
const errorLog = debug("HandleErrorRouter");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use((req, res, next) => {
	res.locals.cspNonce = randomBytes(16).toString("base64");
	// res.locals.darkScheme = req.query.darkTheme || false;
	next();
});

const corsOptions = {
	origin: JSON.parse(process.env.ORIGINS),
	credentials: true,
	optionsSuccessStatus: 200,
};
const helmetOptions = {
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'none'"],
			imgSrc: ["'self'", "data:", "blob:"],
			styleSrc: [
				"'self'",
				"fonts.googleapis.com",
				"necolas.github.io",
				(req, res) => `'nonce-${res.locals.cspNonce}'`,
			],
			frameAncestors: ["'none'"],
			baseUri: ["'none'"],
			objectSrc: ["'none'"],
			scriptSrc: [
				(req, res) => `'nonce-${res.locals.cspNonce}'`,
				"strict-dynamic",
			],
		},
	},
	xFrameOptions: { action: "deny" },
	referrerPolicy: {
		policy: ["no-referrer", "strict-origin-when-cross-origin"],
	},
};
const sessionOptions = {
	secret: JSON.parse(process.env.SESSION_SECRETS),
	resave: false,
	saveUninitialized: false,
	store: MongoStore.create({
		client: db.getClient(),
	}),
	cookie: {
		sameSite: "strict",
		httpOnly: true,
		secure: true,
		maxAge: 7 * 24 * 60 * 60 * 1000,
	},
};
const staticOptions = {
	index: false,
	maxAge: "1d",
	redirect: false,
};

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public"), staticOptions));
app.use(express.json());
app.use(cookieParser());

app.use(rateLimiter);
app.use(morgan("dev"));
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));
app.use(session(sessionOptions));
app.use(passport.session());
app.use(compression());

// index route
app.get("/", (req, res) => res.redirect("/account/login"));

app.use("/account", accountRouter);
app.use("/blog", blogRouter);

// Unknown routes handler
app.use((req, res, next) => {
	next(createError(404, "The endpoint you are looking for cannot be found."));
});

// Errors handler
app.use((err, req, res, next) => {
	errorLog(`${err.name}: ${err.message}`);

	const path = req.path.split("/")[2];

	err.status ?? (err = createError(500));

	path && (path === "login" || path === "register")
		? res.render("error")
		: res.status(err.status).json({
				success: false,
				message: err.message,
		  });
});

export default app;
