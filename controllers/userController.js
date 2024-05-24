const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const verifySchema = require("../utils/verifySchema.js");

const User = require("../models/user");

const userLogin = [
	verifySchema({
		email: {
			trim: true,
			toLowerCase: true,
			notEmpty: {
				errorMessage: "The email is required.",
			},
			escape: true,
		},
		password: {
			trim: true,
			notEmpty: {
				errorMessage: "The password is required.",
			},
			escape: true,
		},
	}),
	asyncHandler(async (req, res, next) => {
		const handleAuthenticate = async () => {
			const { email, password } = req.body;
			const user = await User.findOne({ email });
			const match =
				user && (await bcrypt.compare(password, user.password));

			const handleSignInErrorMessages = () => {
				res.status(404).json({
					success: false,
					message: "Wrong email or password please try again.",
				});
			};

			const setUserId = () => {
				req.userId = user._id;
				next();
			};

			match ? setUserId() : handleSignInErrorMessages();
		};
		handleAuthenticate();
	}),
	asyncHandler((req, res, next) => {
		const oneWeek = 7 * 24 * 60 * 60 * 1000;
		jwt.sign(
			{ id: req.userId },
			process.env.PRIVATE_KEY,
			{ expiresIn: oneWeek / 1000 },
			(err, token) => {
				const exp = Date.now() + oneWeek;
				err
					? next(err)
					: res.json({
							success: true,
							message: req.signUp ?? "Sign in successfully.",
							data: {
								token,
								exp,
							},
					  });
			}
		);
	}),
];
const userRegister = [
	verifySchema({
		name: {
			trim: true,
			notEmpty: {
				errorMessage: "The name is required.",
				bail: true,
			},
			isLength: {
				options: { max: 30 },
				errorMessage: "The name must be less than 30 long.",
				bail: true,
			},
			custom: {
				options: name => name.match(/^[a-zA-Z]\w*$/),
				errorMessage: "The name must be alphanumeric and underscore.",
				bail: true,
			},
			escape: true,
			custom: {
				options: (name, { req }) =>
					new Promise(async (resolve, reject) => {
						const existingName = await User.findOne({
							name,
						}).exec();
						existingName
							? reject((req.schema = { isConflict: true }))
							: resolve();
					}),
				errorMessage: "The name is been used.",
			},
		},
		email: {
			trim: true,
			toLowerCase: true,
			notEmpty: {
				errorMessage: "The email is required.",
				bail: true,
			},
			isEmail: {
				errorMessage: "The email must be in the correct format.",
				bail: true,
			},
			normalizeEmail: {
				errorMessage: "The email must be in standard format.",
				bail: true,
			},
			escape: true,

			custom: {
				options: (email, { req }) =>
					new Promise(async (resolve, reject) => {
						const existingUserEmail = await User.findOne({
							email,
						}).exec();
						existingUserEmail
							? reject((req.schema = { isConflict: true }))
							: resolve();
					}),
				errorMessage: "The email is been used.",
			},
		},
		password: {
			trim: true,
			notEmpty: {
				errorMessage: "The password is required.",
				bail: true,
			},
			isStrongPassword: {
				errorMessage:
					"The password must contain one or more numbers, special symbols, lowercase and uppercase characters, and at least 8 characters without spaces.",
			},
			escape: true,
		},
		confirmPassword: {
			trim: true,
			notEmpty: {
				errorMessage: "The confirm password is required.",
				bail: true,
			},
			escape: true,
			custom: {
				options: (confirmPassword, { req }) =>
					confirmPassword === req.body.password,
				errorMessage:
					"The confirmation password is not the same as the password.",
			},
		},
	}),
	asyncHandler(async (req, res, next) => {
		const randomSalt = 12;

		bcrypt.hash(
			req.body.password,
			randomSalt,
			async (err, hashedPassword) => {
				const handleAddUser = async () => {
					const currentTime = new Date();
					const newUser = new User({
						...req.body,
						password: hashedPassword,
						isAdmin: process.env.NODE_ENV === "development",
						lastModified: currentTime,
						createdAt: currentTime,
					});

					await newUser.save();
					req.signUp = "Sign up successfully.";
					next();
				};

				err ? next(err) : handleAddUser();
			}
		);
	}),
	userLogin,
];
module.exports = {
	userLogin,
	userRegister,
};
