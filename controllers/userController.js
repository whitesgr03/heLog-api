const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { validationResult, checkSchema } = require("express-validator");

const User = require("../models/user");

const userSignInPost = asyncHandler(async (req, res, next) => {
	const validationSchema = {
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
	};

	await checkSchema(validationSchema, ["body"]).run(req);

	const schemaErrors = validationResult(req);

	const { email, password } = req.body;

	const handleAuthenticate = async () => {
		const user = await User.findOne({ email });
		const match = user && (await bcrypt.compare(password, user.password));

		const handleSignIn = () => {
			const oneWeek = 7 * 24 * 60 * 60 * 1000;

			jwt.sign(
				{ id: user._id },
				process.env.PRIVATE_KEY,
				{ expiresIn: oneWeek / 1000 },
				(err, token) => {
					const exp = Date.now() + oneWeek;
					err
						? next(err)
						: res.json({
								success: true,
								message: req.signUp ?? "Sign in success.",
								token,
								exp,
						  });
				}
			);
		};

		const handleSignInErrorMessages = () => {
			res.json({
				success: false,
				message: "Wrong email or password please try again.",
			});
		};

		match ? handleSignIn() : handleSignInErrorMessages();
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

	schemaErrors.isEmpty() ? handleAuthenticate() : handleSchemaErrorMessages();
});
const userSignUpPost = [
	asyncHandler(async (req, res, next) => {
		const validationSchema = {
			name: {
				trim: true,
				isLength: {
					options: { min: 1, max: 30 },
					errorMessage: "The name length must be 1 to 30.",
					bail: true,
				},
				custom: {
					options: value => value.match(/^[a-zA-Z]\w*$/),
					errorMessage:
						"The name must be alphanumeric and underscore.",
					bail: true,
				},
				escape: true,
				custom: {
					options: value =>
						new Promise(async (resolve, reject) => {
							const existingUsername = await User.findOne({
								name: value,
							}).exec();
							existingUsername ? reject() : resolve();
						}),
					errorMessage: "The name is been used.",
				},
			},
			email: {
				trim: true,
				isEmail: {
					errorMessage: "The email must be in the correct format.",
					bail: true,
				},
				normalizeEmail: {
					errorMessage: "The email must be in standard format.",
					bail: true,
				},
				escape: true,
				toLowerCase: true,
				custom: {
					options: value =>
						new Promise(async (resolve, reject) => {
							const existingUserEmail = await User.findOne({
								email: value,
							}).exec();
							existingUserEmail ? reject() : resolve();
						}),
					errorMessage: "The email is been used.",
				},
			},
			password: {
				trim: true,
				isStrongPassword: {
					errorMessage:
						"The password must contain one or more numbers, special symbols, lowercase and uppercase characters, and at least 8 characters without spaces.",
				},
				escape: true,
			},
			confirmPassword: {
				trim: true,
				escape: true,
				custom: {
					options: (value, { req }) => value === req.body.password,
					errorMessage:
						"The confirmation password is not the same as the password.",
				},
			},
		};

		await checkSchema(validationSchema, ["body"]).run(req);

		const schemaErrors = validationResult(req);

		const user = {
			...req.body,
		};

		const handleSignUp = () => {
			const randomSalt = 12;

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
