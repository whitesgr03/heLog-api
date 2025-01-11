import express from "express";

import * as postControllers from "../controllers/postController.js";
import * as commentControllers from "../controllers/commentController.js";
import * as replyControllers from "../controllers/replyController.js";

import { authenticate } from "../middlewares/authenticate.js";

export const blogRouter = express.Router();

blogRouter.get("/posts", postControllers.postList);
blogRouter.get("/posts/:postId", postControllers.postDetail);
blogRouter.get("/posts/:postId/comments", commentControllers.commentList);
blogRouter.get("/comments/:commentId/replies", replyControllers.replyList);

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

blogRouter.post("/comments/:commentId/replies", replyControllers.replyCreate);

blogRouter
	.route("/replies/:replyId")
	.put(replyControllers.replyUpdate)
	.delete(replyControllers.replyDelete);
