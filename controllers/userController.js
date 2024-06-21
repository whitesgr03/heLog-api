const asyncHandler = require("express-async-handler");
const { Types } = require("mongoose");
const bcrypt = require("bcrypt");
const passport = require("../config/password");
const errorLog = require("debug")("ServerError");

// const jwt = require("jsonwebtoken");

const verifySchema = require("../middlewares/verifySchema.js");
const verifyToken = require("../middlewares/verifyToken.js");
const verifyId = require("../middlewares/verifyId.js");

const User = require("../models/user");

// const userDetail = [
// 	verifyToken,
// 	asyncHandler(async (req, res, next) => {
// 		const user = await User.findById(req.user.id, {
// 			name: 1,
// 			isAdmin: 1,
// 			email: 1,
// 		}).exec();
// 		user
// 			? res.json({
// 					success: true,
// 					message: "Get user successfully.",
// 					data: user,
// 			  })
// 			: res.status(404).json({
// 					success: false,
// 					message: "The user could not be found.",
// 			  });
// 	}),
// ];
// const userUpdate = [
// 	verifyToken,
// 	verifyId("user"),
// 	asyncHandler(async (req, res, next) => {
// 		req.params.userId === req.user.id
// 			? next()
// 			: res.status(404).json({
// 					success: false,
// 					message: `The user could not be found.`,
// 			  });
// 	}),
// 	verifySchema({
// 		name: {
// 			trim: true,
// 			notEmpty: {
// 				errorMessage: "The name is required.",
// 				bail: true,
// 			},
// 			isLength: {
// 				options: { max: 30 },
// 				errorMessage: "The name must be less than 30 long.",
// 				bail: true,
// 			},
// 			custom: {
// 				options: name => name.match(/^[a-zA-Z]\w*$/),
// 				errorMessage: "The name must be alphanumeric and underscore.",
// 				bail: true,
// 			},
// 			escape: true,
// 			custom: {
// 				options: (name, { req }) =>
// 					new Promise(async (resolve, reject) => {
// 						const existingName = await User.findOne({
// 							$and: [
// 								{ name },
// 								{
// 									_id: {
// 										$ne: Types.ObjectId.createFromHexString(
// 											req.user.id
// 										),
// 									},
// 								},
// 							],
// 						}).exec();
// 						existingName
// 							? reject((req.schema = { isConflict: true }))
// 							: resolve();
// 					}),
// 				errorMessage: "The name is been used.",
// 			},
// 		},
// 	}),
// 	asyncHandler(async (req, res, next) => {
// 		const newUser = {
// 			...req.data,
// 			lastModified: new Date(),
// 		};
// 		await User.findByIdAndUpdate(req.user.id, newUser).exec();

// 		res.json({
// 			success: true,
// 			message: "Update post successfully.",
// 		});
// 	}),
// ];
// const userDelete = [
// 	verifyToken,
// 	verifyId("user"),
// 	asyncHandler(async (req, res, next) => {
// 		req.params.userId === req.user.id
// 			? next()
// 			: res.status(404).json({
// 					success: false,
// 					message: `The user could not be found.`,
// 			  });
// 	}),
// 	asyncHandler(async (req, res, next) => {
// 		await User.findByIdAndDelete(req.params.userId).exec();
// 		res.json({
// 			success: true,
// 			message: "Delete user successfully.",
// 		});
// 	}),
// ];
const userAuth = [
	asyncHandler((req, res, next) => {
		const createAuthCode = async () => {
			const querySchema = {
				response_type: {
					trim: true,
					notEmpty: {
						errorMessage: "The response type is required.",
						bail: true,
					},
					equals: {
						comparison: "code",
						errorMessage: "Incorrect response type.",
						bail: true,
					},
				},
				client_id: {
					trim: true,
					notEmpty: {
						errorMessage: "The client id is required.",
						bail: true,
					},
					equals: {
						comparison: process.env.CLIENT_ID,
						errorMessage: "Incorrect client id.",
						bail: true,
					},
				},
				redirect_uri: {
					trim: true,
					notEmpty: {
						errorMessage: "The redirect uri is required.",
						bail: true,
					},
					isURL: {
						options: {
							protocols:
								process.env.NODE_ENV === "production"
									? ["https"]
									: ["http", "https"],
							allow_fragments: false,
						},
						errorMessage: "Incorrect redirect uri.",
					},
				},
				state: {
					optional: true,
					trim: true,
				},
			};

			await checkSchema(querySchema, ["query"]).run(req);

			const schemaErrors = validationResult(req);

			const sendAuthCode = () => {
				const [state, redirect_uri] = matchedData(req);
				const code = "";
				res.redirect(`${redirect_uri}?code=${code}&state=${state}`);
			};

			const handleError = () => {
				errorLog(schemaErrors);
				res.render("error");
			};

			// schemaErrors.isEmpty() ? sendAuthCode() :handleError();

			// res.send("The user is Authenticated");
			console.log("The user is Authenticated");
			res.redirect("/account/logout");
		};

		req.isAuthenticated()
			? createAuthCode()
			: res.redirect("/account/login");
	}),
];
const userLoginGet = [
	asyncHandler((req, res, next) => {
		res.render("login");
	}),
];
const userLoginPost = [
	verifySchema({
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
			// custom: {
			// 	options: (email, { req }) =>
			// 		new Promise(async (resolve, reject) => {
			// 			const user = await User.findOne({ email }).exec();
			// 			user ? resolve((req.user = user)) : reject();
			// 		}),
			// 	errorMessage: "The account could not be found.",
			// },
		},
		password: {
			trim: true,
			notEmpty: {
				errorMessage: "The password is required.",
				bail: true,
			},
			isLength: {
				options: { min: 8 },
				errorMessage: "The password is incorrect.",
			},
			escape: true,
		},
	}),
	asyncHandler((req, res, next) => {
		const authenticate = passport.authenticate(
			"local",
			(err, userId, failInfo) => {
				err && next(err);
				failInfo &&
					res.render("userLogin", {
						user: req.data,
						inputErrors: {
							email: failInfo,
						},
					});
				userId &&
					req.login(userId, () => res.redirect("/account/auth"));
			}
		);

		authenticate(req, res, next);
	}),
];
const userRegisterGet = [
	asyncHandler((req, res, next) => {
		res.render("register");
	}),
];
const userRegisterPost = [
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
						const existingNickname = await User.findOne({
							name,
						}).exec();
						existingNickname
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
		const randomSalt = 10;
		bcrypt.hash(
			req.data.password,
			randomSalt,
			async (err, hashedPassword) => {
				const handleAddUser = async () => {
					const currentTime = new Date();
					const newUser = new User({
						...req.data,
						password: hashedPassword,
						isAdmin: process.env.NODE_ENV === "development",
						lastModified: currentTime,
						createdAt: currentTime,
					});
					await newUser.save();
					req.register = "User register successfully.";
					next();
				};
				err ? next(err) : handleAddUser();
			}
		);
	}),
	userLoginPost,
];
const userLogout = [
	asyncHandler(async (req, res, next) => {
		req.user
			? req.logout(err =>
					err
						? next(err)
						: res.json({
								success: true,
								message: "User logged out successfully.",
						  })
			  )
			: res.json({
					success: false,
					message: "User has not logged in yet.",
			  });
	}),
];
module.exports = {
	// userDetail,
	// userUpdate,
	// userDelete,
	userAuth,
	userLoginPost,
	userRegisterPost,
	userLoginGet,
	userRegisterGet,
	userLogout,
};
