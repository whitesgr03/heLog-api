const createError = require("http-errors");
const express = require("express");
const path = require("path");
const logger = require("morgan");
const errorLog = require("debug")("ServerError");

const compression = require("compression");

const app = express();

app.use(compression());
app.use(logger("dev"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));


app.use("/", indexRouter);
app.use("/personal-website", personalSiteRouter);

// Unknown routes handler
app.use((req, res, next) => {
	next(createError(404, "The endpoint you are looking for cannot be found."));
});

// Errors handler
app.use((err, req, res, next) => {
	res.status(err.status || 500);

	errorLog(`${err.name}: ${err.message}`);

	err.status ?? (err = createError(500, ""));

	err.name = err.name.replace(/([A-Z])/g, " $1").trim();

	res.json({ error: err });
});

module.exports = app;
