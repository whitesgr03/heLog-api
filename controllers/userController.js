const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const verifySchema = require("../utils/verifySchema.js");

const User = require("../models/user");

const userLogin = [
	verifySchema({
		email: {
			trim: true,
			notEmpty: {
				errorMessage: "The email is required.",
			},
			escape: true,
			toLowerCase: true,
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

			bcrypt.hash(
				user.password,
				randomSalt,
				async (err, hashedPassword) => {
					const handleAddUser = async () => {
						const currentTime = new Date();
						const newUser = new User({
							...user,
							password: hashedPassword,
							isAdmin: process.env.NODE_ENV === "development",
							lastModified: currentTime,
							createdAt: currentTime,
						});

						await newUser.save();
						req.signUp = "Sign up success.";
						next();
					};

					err ? next(err) : handleAddUser();
				}
			);
		};

		const handleSchemaErrorMessages = () => {
			const errors = schemaErrors.array().map(error => ({
				field: error.path,
				message: error.msg,
			}));

			res.json({
				success: false,
				errors,
			});
		};

		schemaErrors.isEmpty() ? handleSignUp() : handleSchemaErrorMessages();
	}),
	userSignInPost,
];
module.exports = {
	userSignUpPost,
	userSignInPost,
};
