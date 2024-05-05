const express = require("express");
const router = express.Router();

const userControllers = require("../controllers/userController");
const postControllers = require("../controllers/postController");

router.post("/users", userControllers.userRegister);
router.post("/users/login", userControllers.userLogin);

router
	.route("/posts")
	.get(postControllers.postList)
	.post(postControllers.postCreate);

router
	.route("/posts/:id")
	.get(postControllers.postDetail)
	.put(postControllers.postUpdate)
	.delete(postControllers.postDelete);


module.exports = router;
