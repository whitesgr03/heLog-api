const asyncHandler = require("express-async-handler");
const { Types } = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const verifySchema = require("../utils/verifySchema.js");
const verifyToken = require("../utils/verifyToken.js");
const verifyId = require("../utils/verifyId");

const User = require("../models/user");

const userDetail = [
	verifyToken,
	asyncHandler(async (req, res, next) => {
		const user = await User.findById(req.user.id, {
			name: 1,
			isAdmin: 1,
			email: 1,
		}).exec();
		user
			? res.json({
					success: true,
					message: "Get user successfully.",
					data: user,
			  })
			: res.status(404).json({
					success: false,
					message: "The user could not be found.",
			  });
	}),
];

const userUpdate = [
	verifyToken,
	verifyId("user"),
	asyncHandler(async (req, res, next) => {
		req.params.userId === req.user.id
			? next()
			: res.status(404).json({
					success: false,
					message: `The user could not be found.`,
			  });
	}),
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
	verifyId("user"),
	asyncHandler(async (req, res, next) => {
		req.params.userId === req.user.id
			? next()
			: res.status(404).json({
					success: false,
					message: `The user could not be found.`,
			  });
	}),
	asyncHandler(async (req, res, next) => {
		await User.findByIdAndDelete(req.params.userId).exec();
		res.json({
			success: true,
			message: "Delete user successfully.",
		});
	}),
];
const userLogin = [
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
			custom: {
				options: (email, { req }) =>
					new Promise(async (resolve, reject) => {
						const user = await User.findOne({ email }).exec();
						user ? resolve((req.user = user)) : reject();
					}),
				errorMessage: "The account could not be found.",
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
	asyncHandler(async (req, res, next) => {
		const match = await bcrypt.compare(
			req.data.password,
			req.user.password
		);

		match
			? next()
			: res.status(404).json({
					success: false,
					errors: [
						{
							field: "email",
							message: "The account could not be found.",
						},
					],
			  });
	}),
	asyncHandler((req, res, next) => {
		const oneWeek = 7 * 24 * 60 * 60 * 1000;
		jwt.sign(
			{ id: req.user._id },
			process.env.PRIVATE_KEY,
			{ expiresIn: oneWeek / 1000 },
			(err, token) => {
				const exp = Date.now() + oneWeek;
				err
					? next(err)
					: res.json({
							success: true,
							message: req.register ?? "User login successfully.",
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
					confirmPassword === req.data.password,
				errorMessage:
					"The confirmation password is not the same as the password.",
			},
		},
	}),
	asyncHandler(async (req, res, next) => {
		const randomSalt = 12;

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
	userLogin,
];
module.exports = {
	userDetail,
	userUpdate,
	userDelete,
	userLogin,
	userRegister,
};
