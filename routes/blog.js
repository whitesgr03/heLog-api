import express from "express";

import * as postControllers from "../controllers/postController.js";
import * as commentControllers from "../controllers/commentController.js";
import * as replyControllers from "../controllers/replyController.js";

const router = express.Router();
router.use(express.json());

router.use((req, res, next) => {
	res.header({
		"Content-Type": "application/json; charset=UTF-8",
	});
	next();
});


router
	.route("/posts")
	.get(postControllers.postList)
	.post(postControllers.postCreate);

router.get("/posts", postControllers.postListUser);

router
	.route("/posts/:postId")
	.get(postControllers.postDetail)
	.put(postControllers.postUpdate)
	.delete(postControllers.postDelete);

router
	.route("/comments")
	.get(commentControllers.commentList)
	.post(commentControllers.commentCreate);
router
	.route("/comments/:commentId")
	.put(commentControllers.commentUpdate)
	.delete(commentControllers.commentDelete);

router
	.route("/replies")
	.get(replyControllers.replyList)
	.post(replyControllers.replyCreate);
router
	.route("/replies/:replyId")
	.put(replyControllers.replyUpdate)
	.delete(replyControllers.replyDelete);

export default router;
