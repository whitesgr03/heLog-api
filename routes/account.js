import express from "express";

import * as userControllers from "../controllers/userController.js";
import * as codeControllers from "../controllers/acthCodeController.js";

const router = express.Router();

router.get("/auth/code", codeControllers.authCode);

router
	.route("/auth/token")
	.get(codeControllers.authToken)
	.post(express.json(), codeControllers.tokenCreate);

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
