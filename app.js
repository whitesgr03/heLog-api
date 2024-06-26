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
// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(passport.session());
app.use(compression());

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

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

export default app;
