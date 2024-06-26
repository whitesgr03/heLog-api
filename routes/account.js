import { randomBytes } from "node:crypto";
import express from "express";

import * as userControllers from "../controllers/userController.js";

const router = express.Router();
const cors = require("cors");
const { randomBytes } = require("node:crypto");

const corsOptions = {
	origin: "*",
	optionsSuccessStatus: 200,
};

const userControllers = require("../controllers/userController");

router.use(cors(corsOptions));
router.use((req, res, next) => {
	res.locals.cspNonce = randomBytes(16).toString("base64");
	// res.locals.darkScheme = req.query.darkTheme || false;
	next();
});

router.get("/logout", userControllers.userLogout);

router
	.route("/login")
	.get(userControllers.userLoginGet)
	.post(userControllers.userLoginPost);
router
	.route("/register")
	.get(userControllers.userRegisterGet)
	.post(userControllers.userRegisterPost);

// router.get("/users/login", userControllers.userLogin);
// router.get("/users/register", userControllers.userRegister);
// router.post("/users", userControllers.userRegister);

// router
// 	.route("/users/:userId")
// 	.get(userControllers.userDetail)
// 	.put(userControllers.userUpdate)
// 	.delete(userControllers.userDelete);

export default router;
