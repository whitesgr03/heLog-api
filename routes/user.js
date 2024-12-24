import express from "express";

import * as userControllers from "../controllers/userController.js";

import { authenticate } from "../middlewares/authenticate.js";

export const userRouter = express.Router();

userRouter.use(authenticate);

userRouter.get("/posts", userControllers.userPostList);

userRouter
	.route("/")
	.get(userControllers.userDetail)
	.patch(userControllers.userUpdate)
	.delete(userControllers.userDelete);
