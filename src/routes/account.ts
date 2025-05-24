import express from "express";

import * as accountControllers from "../controllers/accountController.js";

export const accountRouter = express.Router();

accountRouter.get("/login/google", accountControllers.googleLogin);
accountRouter.get("/oauth2/redirect/google", accountControllers.googleRedirect);

accountRouter.get("/login/facebook", accountControllers.facebookLogin);
accountRouter.get(
	"/oauth2/redirect/facebook",
	accountControllers.facebookRedirect
);

accountRouter.post("/logout", accountControllers.userLogout);
