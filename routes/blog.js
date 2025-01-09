import express from "express";

import * as postControllers from "../controllers/postController.js";
import * as commentControllers from "../controllers/commentController.js";
import { authenticate } from "../middlewares/authenticate.js";

export const blogRouter = express.Router();

blogRouter.get("/posts", postControllers.postList);
blogRouter.get("/posts/:postId/comments", commentControllers.commentList);

blogRouter.use(authenticate);

blogRouter.post("/posts", postControllers.postCreate);

blogRouter
	.route("/posts/:postId")
	.patch(postControllers.postUpdate)
	.delete(postControllers.postDelete);

blogRouter.post("/posts/:postId/comments", commentControllers.commentCreate);

blogRouter
	.route("/comments/:commentId")
	.patch(commentControllers.commentUpdate)
	.delete(commentControllers.commentDelete);

blogRouter
	.route("/comments/:commentId/replies")
	.get(replyControllers.replyList)
	.post(replyControllers.replyCreate);
blogRouter
	.route("/replies/:replyId")
	.put(replyControllers.replyUpdate)
	.delete(replyControllers.replyDelete);
