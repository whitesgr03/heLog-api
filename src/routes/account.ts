import express from "express";

import * as accountControllers from "../controllers/accountController.js";

export const accountRouter = express.Router();

accountRouter.post("/logout", accountControllers.userLogout);
accountRouter.get("/login", accountControllers.login);

accountRouter.get("/login/google", accountControllers.googleLogin);
accountRouter.get("/oauth2/redirect/google", accountControllers.googleRedirect);

accountRouter.get("/login/facebook", accountControllers.facebookLogin);
accountRouter.get(
	"/oauth2/redirect/facebook",
	accountControllers.facebookRedirect
);
