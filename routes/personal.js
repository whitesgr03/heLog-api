const express = require("express");
const router = express.Router();

const userControllers = require("../controllers/userController");

router.post("/users", userControllers.userRegister);
router.post("/users/login", userControllers.userLogin);


module.exports = router;
