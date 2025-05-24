import express from "express";

import * as userControllers from "../controllers/userController.js";

import { authenticate } from "../middlewares/authenticate.js";
import { validationCSRF } from "../middlewares/validationCSRF.js";

export const userRouter = express.Router();

userRouter.use(authenticate);

userRouter.get("/posts", userControllers.userPostList);
userRouter.get("/posts/:postId", userControllers.userPostDetail);

userRouter.use(validationCSRF);

userRouter
	.route("/")
	.get(userControllers.userDetail)
	.patch(userControllers.userUpdate)
	.delete(userControllers.userDelete);
