const express = require("express");
const router = express.Router();

const userControllers = require("../controllers/userController");


router.post("/user/sign-up", userControllers.userSignUpPost);
router.post("/user/sign-in", userControllers.userSignInPost);

module.exports = router;
