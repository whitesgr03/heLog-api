import express from "express";

import * as userControllers from "../controllers/userController.js";

const router = express.Router();

router.use(express.urlencoded({ extended: false }));

router.use((req, res, next) => {
	res.locals.darkScheme = Boolean(Number(req.query.darkTheme ?? false));
	res.locals.clientUrl = process.env.CLIENT_URL;
	next();
});

router
	.route("/login")
	.get(userControllers.userLoginGet)
	.post(userControllers.userLoginPost);
router
	.route("/register")
	.get(userControllers.userRegisterGet)
	.post(userControllers.userRegisterPost);

router.get("/logout", userControllers.userLogout);

export default router;
