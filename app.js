import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import createError from "http-errors";
import morgan from "morgan";
import debug from "debug";
import MongoStore from "connect-mongo";
import session from "express-session";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";

// config
import passport from "./config/passport.js";
import db from "./config/database.js";

// routes
import accountRouter from "./routes/account.js";
import blogRouter from "./routes/blog.js";

const app = express();
const errorLog = debug("ServerError");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const corsOptions = {
	origin: JSON.parse(process.env.ORIGIN),
	optionsSuccessStatus: 200,
};
const helmetOptions = {
	contentSecurityPolicy: {
		directives: {
			imgSrc: ["'self'", "data:", "blob:"],
			styleSrc: ["'self'", "fonts.googleapis.com", "necolas.github.io"],
			frameAncestors: ["'none'"],
			baseUri: ["'none'"],
			objectSrc: ["'none'"],
			scriptSrc: [
				(req, res) => `'nonce-${res.locals.cspNonce}'`,
				"strict-dynamic",
			],
		},
	},
};
const sessionOptions = {
	secret: JSON.parse(process.env.SESSION_SECRET),
	resave: false,
	saveUninitialized: false,
	store: MongoStore.create({
		client: db.getClient(),
	}),
	cookie: {
		sameSite: true,
		secure: process.env.NODE_ENV === "production",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	},
};
const morganOption = {
	skip: (req, res) => req.baseUrl !== "/account",
};

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(
	morgan("dev", process.env.NODE_ENV === "development" ? morganOption : {})
);
app.use(helmet(process.env.NODE_ENV === "production" ? helmetOptions : {}));
app.use(cors(corsOptions));
app.use(session(sessionOptions));
app.use(passport.session());
app.use(compression());

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.get("/", (req, res) => res.redirect("/account/auth"));
app.use("/account", accountRouter);
app.use("/blog", blogRouter);

// Unknown routes handler
app.use((req, res, next) => {
	next(createError(404, "The endpoint you are looking for cannot be found."));
});

// Errors handler
app.use((err, req, res, next) => {
	errorLog(`${err.name}: ${err.message}`);

	const path = req.baseUrl.split("/")[3] || "login";

	err.status ?? (err = createError(500));

	path && (path === "login" || path === "register")
		? res.render("error")
		: res.status(err.status).json({
				success: false,
				message: err.message,
		  });
});

export default app;
