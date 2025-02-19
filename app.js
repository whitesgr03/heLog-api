import express from "express";
import createError from "http-errors";
import morgan from "morgan";
import debug from "debug";
import session from "express-session";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import MongoStore from "connect-mongo";

// config
import { mongoose } from "./config/database.js";
import { passport } from "./config/passport.js";

// routes
import { accountRouter } from "./routes/account.js";
import { blogRouter } from "./routes/blog.js";
import { userRouter } from "./routes/user.js";

export const app = express();
const errorLog = debug("ServerError");
const corsOptions = {
	origin: process.env.ALLOW_CLIENT_ORIGINS.split(","),
	methods: ["GET", "POST", "PATCH", "DELETE"],
	credentials: true,
	allowedHeaders: ["Content-Type"],
	maxAge: 3600,
};
const sessionOptions = {
	secret: process.env.SESSION_SECRETS.split(","),
	resave: false,
	saveUninitialized: false,
	store: MongoStore.create(mongoose.connection),
	cookie: {
		sameSite: "Lax",
		httpOnly: true,
		secure: !process.env.NODE_ENV === "development",
		maxAge: 30 * 24 * 60 * 60 * 1000,
	},
	name: "helog.sid",
};

app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.use(helmet());
app.use(session(sessionOptions));
app.use(passport.session());
app.use(morgan(process.env.production ? "common" : "dev"));
app.use(compression());

app.use(express.json());

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
