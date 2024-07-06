import asyncHandler from "express-async-handler";
import bcrypt from "bcrypt";
import { Types } from "mongoose";

import { sessionStore } from "../config/database.js";

import verifyFormSchema from "../middlewares/verifyFormSchema.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyScope from "../middlewares/verifyScope.js";
import verifyQuery from "../middlewares/verifyQuery.js";
import verifyAuthenticated from "../middlewares/verifyAuthenticated.js";
import handleLogin from "../middlewares/handleLogin.js";

import User from "../models/user.js";

const userUpdate = [
	verifyToken,
	asyncHandler(async (req, res, next) => {
		req.user.id
			? next()
			: res.status(404).json({
					success: false,
					message: `The user could not be found.`,
			  });
	}),
	verifyScope("update_user"),
	verifyJSONSchema({
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
							$and: [
								{ name },
								{
									_id: {
										$ne: Types.ObjectId.createFromHexString(
											req.user.id
										),
									},
								},
							],
						}).exec();
						existingName
							? reject((req.schema = { isConflict: true }))
							: resolve();
					}),
				errorMessage: "The name is been used.",
			},
		},
	}),
	asyncHandler(async (req, res, next) => {
		const newUser = {
			...req.data,
			lastModified: new Date(),
		};
		await User.findByIdAndUpdate(req.user.id, newUser).exec();

		res.json({
			success: true,
			message: "Update post successfully.",
		});
	}),
];
const userDelete = [
	verifyToken,
	asyncHandler(async (req, res, next) => {
		req.user.id
			? next()
			: res.status(404).json({
					success: false,
					message: `The user could not be found.`,
			  });
	}),
	verifyScope("delete_user"),
	asyncHandler(async (req, res, next) => {
		await User.findByIdAndDelete(req.user.id).exec();
		sessionStore.destroy(req.payload.sid, err =>
			err
				? next(err)
				: res.clearCookie("helog.connect.sid").json({
						success: true,
						message: "Delete user successfully.",
				  })
		);
	}),
];
const userInfo = [
	verifyToken,
	verifyScope("read_user"),
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, {
			name: 1,
			isAdmin: 1,
			email: 1,
			_id: 0,
		}).exec();
		user
			? res.json({
					success: true,
					message: "Get user info successfully.",
					data: user,
			  })
			: res.status(404).json({
					success: false,
					message: "The user could not be found.",
			  });
	}),
];
const userLoginGet = [
	verifyAuthenticated,
	verifyQuery,
	asyncHandler((req, res, next) => {
		const {
			state,
			code_challenge,
			code_challenge_method,
			scope,
			darkTheme,
		} = req.query;
		res.render("login", {
			state,
			code_challenge,
			code_challenge_method,
			scope,
			darkTheme,
		});
	}),
];
const userLoginPost = [
	asyncHandler((req, res, next) => {
		console.log(req.isAuthenticated());
		req.is("application/x-www-form-urlencoded")
			? next()
			: res.status(400).json({
					success: false,
					message: "The content type is invalid",
			  });
	}),
	verifyAuthenticated,
	verifyQuery,
	verifyFormSchema({
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
	handleLogin,
];
const userRegisterGet = [
	verifyQuery,
	asyncHandler((req, res, next) => {
		const {
			state,
			code_challenge,
			code_challenge_method,
			scope,
			darkTheme,
		} = req.query;

		res.render("register", {
			state,
			code_challenge,
			code_challenge_method,
			scope,
			darkTheme,
		});
	}),
];
const userRegisterPost = [
	asyncHandler((req, res, next) => {
		req.is("application/x-www-form-urlencoded")
			? next()
			: res.status(400).json({
					success: false,
					message: "The content type is invalid",
			  });
	}),
	verifyQuery,
	verifyFormSchema({
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
					next();
				};
				err ? next(err) : handleAddUser();
			}
		);
	}),
	handleLogin,
];
const userLogout = [
	asyncHandler((req, res, next) => {
		!req.isAuthenticated() ? res.redirect(process.env.CLIENT_URL) : next();
	}),
	asyncHandler(async (req, res, next) => {
		req.logout(err =>
			err
				? next(err)
				: req.session.destroy(err => {
						err
							? next(err)
							: res
									.clearCookie("helog.connect.sid")
									.redirect(process.env.REDIRECT_URL);
				  })
		);
	}),
];

export {
	userUpdate,
	userDelete,
	userInfo,
	userLoginPost,
	userRegisterPost,
	userLoginGet,
	userRegisterGet,
	userLogout,
};
