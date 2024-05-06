const createError = require("http-errors");
const express = require("express");
const logger = require("morgan");
const errorLog = require("debug")("ServerError");

const compression = require("compression");

const personalRouter = require("./routes/personal");

const app = express();

app.use(compression());
app.use(logger("dev"));

app.use(express.json());

app.use("/personal", personalRouter);

// Unknown routes handler
app.use((req, res, next) => {
	next(createError(404, "The endpoint you are looking for cannot be found."));
});

// Errors handler
app.use((err, req, res, next) => {
	errorLog(`${err.name}: ${err.message}`);

	err.status ?? (err = createError(500));

	res.status(err.status).json({
		success: false,
		message: err.message,
	});
});

module.exports = app;
