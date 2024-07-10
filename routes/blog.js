import express from "express";

import * as postControllers from "../controllers/postController.js";
import * as commentControllers from "../controllers/commentController.js";
import * as userControllers from "../controllers/userController.js";

const router = express.Router();
router.use(express.json());

router.use((req, res, next) => {
	res.header({
		"Content-Type": "application/json; charset=UTF-8",
	});
	next();
});

router
	.route("/user")
	.get(userControllers.userInfo)
	.put(userControllers.userUpdate)
	.delete(userControllers.userDelete);

router
	.route("/posts")
	.get(postControllers.postList)
	.post(postControllers.postCreate);

router
	.route("/posts/:postId")
	.get(postControllers.postDetail)
	.put(postControllers.postUpdate)
	.delete(postControllers.postDelete);

router
	.route("/posts/:postId/comments")
	.get(commentControllers.commentList)
	.post(commentControllers.commentCreate);

router
	.route("/posts/:postId/comments/:commentId")
	.post(commentControllers.commentReplyCreate)
	.put(commentControllers.commentUpdate)
	.delete(commentControllers.commentDelete);

export default router;
