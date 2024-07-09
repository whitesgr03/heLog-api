import express from "express";

import * as authCodeControllers from "../controllers/authCodeController.js";

const router = express.Router();

router.use(express.json());

router.get("/code", authCodeControllers.authCode);

router
	.route("/token")
	.get(authCodeControllers.tokenVerify)
	.post(authCodeControllers.tokenCreate);

router.post("/token/refresh", authCodeControllers.tokenExChange);

export default router;
