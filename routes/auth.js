const express = require("express");
const router = express.Router();
const cors = require("cors");

const corsOptions = {
	origin: "*",
	optionsSuccessStatus: 200,
};

const oAuthControllers = require("../controllers/oAuthController");

router.use(cors(corsOptions));

router.get("/authorize", oAuthControllers.oAuthCodeCreate);
router.get("/token", oAuthControllers.oAuthTokenCreate);

module.exports = router;
