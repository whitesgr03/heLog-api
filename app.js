import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import express from "express";
import createError from "http-errors";
import morgan from "morgan";
import debug from "debug";
import session from "express-session";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";

// config
import passport from "./config/passport.js";
import { sessionStore } from "./config/database.js";

// routes
import accountRouter from "./routes/account.js";
import blogRouter from "./routes/blog.js";
import authRouter from "./routes/auth.js";

const app = express();
const errorLog = debug("HandleErrorRouter");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use((req, res, next) => {
	res.locals.cspNonce = randomBytes(16).toString("base64");
	next();
});

const corsOptions = {
	origin: process.env.ALLOW_CLIENT_ORIGINS.split(","),
	methods: ["GET", "PUT", "POST", "DELETE"],
	allowedHeaders: ["Content-Type", "Authorization"],
	maxAge: 3600,
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
			formAction: [
				"'self'",
				`${process.env.NODE_ENV === "development" ? "http" : "https"}:`,
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
		policy: ["no-referrer"],
	},
};
const sessionOptions = {
	secret: process.env.SESSION_SECRETS.split(","),
	resave: false,
	saveUninitialized: false,
	store: sessionStore,
	cookie: {
		sameSite: "Lax",
		httpOnly: true,
		secure: !process.env.NODE_ENV === "development",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	},
	name: "helog.connect.sid",
};
const staticOptions = {
	index: false,
	maxAge: "1d",
	redirect: false,
};

app.set("trust proxy", 1);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(cors(corsOptions));
app.use(helmet(helmetOptions));
app.use(session(sessionOptions));
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public"), staticOptions));
app.use(morgan(process.env.production ? "common" : "dev"));
app.use(compression());

app.use((req, res, next) => {
	res.locals.clientUrl = process.env.HELOG_URL;
	res.locals.darkScheme = req.session?.queries?.darkTheme === "true";
	next();
});

app.get("/", (req, res) => res.redirect(process.env.HELOG_URL));
app.use("/account", accountRouter);
app.use("/auth", authRouter);
app.use("/blog", blogRouter);

// Unknown routes handler
app.use((req, res, next) => {
	next(createError(404, "The endpoint you are looking for cannot be found."));
});

// Errors handler
app.use((err, req, res, next) => {
	errorLog(err);

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
