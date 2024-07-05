import express from "express";

import * as userControllers from "../controllers/userController.js";
import * as authCodeControllers from "../controllers/authCodeController.js";

const router = express.Router();

router.get("/auth/code", authCodeControllers.authCode);

router
	.route("/auth/token")
	.get(authCodeControllers.authToken)
	.post(express.json(), authCodeControllers.tokenCreate);

router
	.route("/login")
	.get(userControllers.userLoginGet)
	.post(
		express.urlencoded({ extended: false }),
		userControllers.userLoginPost
	);
router
	.route("/register")
	.get(userControllers.userRegisterGet)
	.post(
		express.urlencoded({ extended: false }),
		userControllers.userRegisterPost
	);

router.get("/logout", userControllers.userLogout);

export default router;
