const createError = require("http-errors");
const express = require("express");
const path = require("path");
const logger = require("morgan");
const errorLog = require("debug")("ServerError");

const MongoStore = require("connect-mongo");
const session = require("express-session");

const passport = require("./config/password");
const db = require("./config/database");

const compression = require("compression");
const helmet = require("helmet");

const authRouter = require("./routes/auth");
const accountRouter = require("./routes/account");
const blogRouter = require("./routes/blog");

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

process.env.NODE_ENV === "production" &&
	app.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					imgSrc: ["'self'", "data:", "blob:"],
					styleSrc: [
						"'self'",
						"fonts.googleapis.com",
						"necolas.github.io",
					],
					baseUri: ["'none'"],
					objectSrc: ["'none'"],
					scriptSrc: [
						(req, res) => `'nonce-${res.locals.cspNonce}'`,
						"strict-dynamic",
					],
				},
			},
		})
	);

app.use(compression());
app.use(
	logger("dev", {
		skip: (req, res) => req.baseUrl !== "/account",
	})
);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.use(
	session({
		secret: "HeLog",
		resave: false,
		saveUninitialized: false,
		store: MongoStore.create({
			client: db.getClient(),
		}),
		cookie: {
			maxAge: 7 * 24 * 60 * 60 * 1000,
		},
	})
);
app.use(passport.session());

app.get("/", (req, res) => res.redirect("/account/auth"));
// app.get("/", (req, res, next) => next("gg"));
app.use("/oauth2", authRouter);
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

module.exports = app;
