import express from "express";

import * as postControllers from "../controllers/postController.js";
import * as commentControllers from "../controllers/commentController.js";

const router = express.Router();
const cors = require("cors");

const corsOptions = {
	origin: "*",
	optionsSuccessStatus: 200,
};

const postControllers = require("../controllers/postController");
const commentControllers = require("../controllers/commentController");

router.use(cors(corsOptions));

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
