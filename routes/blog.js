const express = require("express");
const router = express.Router();
const cors = require("cors");

const corsOptions = {
	origin: "*",
	optionsSuccessStatus: 200,
};

const userControllers = require("../controllers/userController");
const postControllers = require("../controllers/postController");
const commentControllers = require("../controllers/commentController");

router
	.route("/user")
	.options(cors(corsOptions))
	.get(cors(corsOptions), userControllers.userDetail);
router.post("/users", userControllers.userRegister);
router
	.route("/users/login")
	.options(cors(corsOptions))
	.post(cors(corsOptions), userControllers.userLogin);

router
	.route("/posts")
	.get(cors(corsOptions), postControllers.postList)
	.post(postControllers.postCreate);

router
	.route("/posts/:postId")
	.get(cors(corsOptions), postControllers.postDetail)
	.put(postControllers.postUpdate)
	.delete(postControllers.postDelete);

router
	.route("/posts/:postId/comments")
	.get(commentControllers.commentList)
	.post(commentControllers.commentCreate);

router
	.route("/posts/:postId/comments/:commentId")
	.post(commentControllers.commentCreate)
	.put(commentControllers.commentUpdate)
	.delete(commentControllers.commentDelete);

module.exports = router;
