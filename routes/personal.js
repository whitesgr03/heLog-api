const express = require("express");
const router = express.Router();

const userControllers = require("../controllers/userController");
const postControllers = require("../controllers/postController");
const commentControllers = require("../controllers/commentController");

router.post("/users", userControllers.userRegister);
router.post("/users/login", userControllers.userLogin);

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
	.put(commentControllers.commentUpdate)
	.delete(commentControllers.commentDelete);

module.exports = router;
