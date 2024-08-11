import asyncHandler from "express-async-handler";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
import Csrf from "csrf";
import debug from "debug";
import passport from "../config/passport.js";

import { sessionStore } from "../config/database.js";

import verifyFormSchema from "../middlewares/verifyFormSchema.js";
import verifyJSONSchema from "../middlewares/verifyJSONSchema.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyQuery from "../middlewares/verifyQuery.js";
import verifyAuthenticated from "../middlewares/verifyAuthenticated.js";
import handleLogin from "../middlewares/handleLogin.js";

import User from "../models/user.js";
import RefreshToken from "../models/refreshToken.js";
import Post from "../models/post.js";
import Comment from "../models/comment.js";
import Reply from "../models/reply.js";
import FederatedCredential from "../models/federatedCredential.js";

const serverLog = debug("Server");

const csrf = new Csrf();

const userInfo = [
	verifyToken,
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, {
			name: 1,
			isAdmin: 1,
			email: 1,
		}).exec();

		res.header({
			"Cache-Control": "no-store",
		}).json({
			success: true,
			message: "Get user info successfully.",
			data: user,
		});
	}),
];
const userUpdate = [
	verifyToken,
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
		const user = await User.findByIdAndUpdate(req.user.id, newUser, {
			new: true,
			select: {
				name: 1,
			},
		}).exec();

		res.json({
			success: true,
			message: "Update user successfully.",
			data: user,
		});
	}),
];
const userDelete = [
	verifyToken,
	asyncHandler(async (req, res, next) => {
		const posts = await Post.find(
			{ author: req.user.id },
			{ _id: 1 }
		).exec();

		await Promise.all([
			...posts.map(async post => {
				Promise.all([
					Comment.deleteMany({ post: post._id }).exec(),
					Reply.deleteMany({ post: post._id }).exec(),
					post.deleteOne(),
				]);
			}),
			User.findByIdAndDelete(req.user.id).exec(),
			RefreshToken.findOneAndDelete({
				user: req.user.id,
			}).exec(),
			FederatedCredential.findOneAndDelete({
				user: req.user.id,
			}).exec(),
			Comment.updateMany(
				{
					author: req.user.id,
				},
				{
					content: "Comment deleted by user",
					lastModified: new Date(),
					deleted: true,
				}
			).exec(),
			Reply.updateMany(
				{
					author: req.user.id,
				},
				{
					content: "Reply deleted by user",
					lastModified: new Date(),
					deleted: true,
				}
			).exec(),
		]);

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
const userLoginGet = [
	verifyAuthenticated,
	verifyQuery,
	asyncHandler(async (req, res, next) => {
		const secret = await csrf.secret();
		req.session.csrf = secret;
		res.render("login", {
			csrfToken: csrf.create(secret),
		});
	}),
];
const userLoginPost = [
	verifyAuthenticated,
	verifyQuery,
	asyncHandler((req, res, next) => {
		const setSession = () => {
			delete req.session.csrf;
			next();
		};

		const handleError = () => {
			serverLog("The csrf token is invalid.");
			res.render("error");
		};

		csrf.verify(req.session.csrf, req.body.csrfToken)
			? setSession()
			: handleError();
	}),
	asyncHandler((req, res, next) => {
		req.is("application/x-www-form-urlencoded")
			? next()
			: res.status(400).json({
					success: false,
					message: "The content type is invalid",
			  });
	}),
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
	verifyAuthenticated,
	verifyQuery,
	asyncHandler(async (req, res, next) => {
		const secret = await csrf.secret();
		req.session.csrf = secret;
		res.render("register", {
			csrfToken: csrf.create(secret),
		});
	}),
];
const userRegisterPost = [
	verifyAuthenticated,
	verifyQuery,
	asyncHandler((req, res, next) => {
		const setSession = () => {
			delete req.session.csrf;
			next();
		};

		const handleError = () => {
			serverLog("The csrf token is invalid.");
			res.render("error");
		};

		csrf.verify(req.session.csrf, req.body.csrfToken)
			? setSession()
			: handleError();
	}),
	asyncHandler((req, res, next) => {
		req.is("application/x-www-form-urlencoded")
			? next()
			: res.status(400).json({
					success: false,
					message: "The content type is invalid",
			  });
	}),
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
				options: name => name.match(/^[a-zA-Z0-9]\w*$/),
				errorMessage: "The name must be alphanumeric.",
				bail: true,
			},
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
		!req.isAuthenticated() ? res.redirect(process.env.HELOG_URL) : next();
	}),
	asyncHandler(async (req, res, next) => {
		await RefreshToken.findOneAndDelete({
			user: req.user._id,
		}).exec();

		req.logout(err =>
			err
				? next(err)
				: req.session.destroy(err => {
						err
							? next(err)
							: res
									.clearCookie("helog.connect.sid")
									.redirect(process.env.HELOG_URL);
				  })
		);
	}),
];
const googleLogin = [
	verifyAuthenticated,
	verifyQuery,
	passport.authenticate("google"),
];
const googleRedirect = [
	verifyAuthenticated,
	verifyQuery,
	asyncHandler((req, res, next) => {
		req.query.error ? res.redirect("/account/login") : next();
	}),
	asyncHandler((req, res, next) => {
		const authenticateFn = passport.authenticate(
			"google",
			async (err, user) => {
				err && next(err);

				const handleLogin = () => {
					const queries = req.session.queries;

					const cb = () => {
						req.session.queries = queries;
						res.redirect("/auth/code");
					};

					req.login(user, cb);
				};
				user && handleLogin();
			}
		);
		authenticateFn(req, res, next);
	}),
];

const facebookLogin = [
	verifyAuthenticated,
	verifyQuery,
	passport.authenticate("facebook"),
];
const facebookRedirect = [
	verifyAuthenticated,
	verifyQuery,
	asyncHandler((req, res, next) => {
		req.query.error ? res.redirect("/account/login") : next();
	}),
	asyncHandler((req, res, next) => {
		const authenticateFn = passport.authenticate(
			"facebook",
			async (err, user) => {
				err && next(err);

				const handleLogin = () => {
					const queries = req.session.queries;

					const cb = () => {
						req.session.queries = queries;
						res.redirect("/auth/code");
					};

					req.login(user, cb);
				};
				user && handleLogin();
			}
		);
		authenticateFn(req, res, next);
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
	googleLogin,
	googleRedirect,
	facebookLogin,
	facebookRedirect,
};
