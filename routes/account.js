import express from "express";

import * as userControllers from "../controllers/userController.js";

const router = express.Router();
router.use(express.urlencoded({ extended: false }));

router
	.route("/login")
	.get(userControllers.userLoginGet)
	.post(userControllers.userLoginPost);
router
	.route("/register")
	.get(userControllers.userRegisterGet)
	.post(userControllers.userRegisterPost);

router.get("/logout", userControllers.userLogout);

router.get("/login/google", userControllers.googleLogin);
router.get("/oauth2/redirect/google", userControllers.googleRedirect);
router.get("/login/facebook", userControllers.facebookLogin);
router.get("/oauth2/redirect/facebook", userControllers.facebookRedirect);

export default router;
