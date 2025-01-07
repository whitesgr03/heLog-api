import express from "express";

import * as postControllers from "../controllers/postController.js";
import * as commentControllers from "../controllers/commentController.js";
import { authenticate } from "../middlewares/authenticate.js";

export const blogRouter = express.Router();

blogRouter
	.route("/posts")
	.get(postControllers.postList)
	.post(postControllers.postCreate);


blogRouter.use(authenticate);
blogRouter
	.route("/posts/:postId")
	.get(postControllers.postDetail)
	.put(postControllers.postUpdate)
	.delete(postControllers.postDelete);

blogRouter
	.route("/comments")
	.get(commentControllers.commentList)
	.post(commentControllers.commentCreate);
blogRouter
	.route("/comments/:commentId")
	.put(commentControllers.commentUpdate)
	.delete(commentControllers.commentDelete);

blogRouter
	.route("/replies")
	.get(replyControllers.replyList)
	.post(replyControllers.replyCreate);
blogRouter
	.route("/replies/:replyId")
	.put(replyControllers.replyUpdate)
	.delete(replyControllers.replyDelete);
