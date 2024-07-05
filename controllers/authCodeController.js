import asyncHandler from "express-async-handler";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { sessionStore } from "../config/database.js";

import generateCodeChallenge from "../utils/generateCodeChallenge.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyQuery from "../middlewares/verifyQuery.js";

import AuthCode from "../models/authCode.js";

const authCode = [
	verifyQuery,
	asyncHandler((req, res, next) => {
		const {
			state,
			code_challenge,
			code_challenge_method,
			scope,
			darkTheme,
		} = req.query;

		req.isAuthenticated()
			? next()
			: res.redirect(
					`/account/login?state=${state}` +
						`&code_challenge=${code_challenge}` +
						`&code_challenge_method=${code_challenge_method}` +
						`&scope=${scope}` +
						`&darkTheme=${darkTheme}`
			  );
	}),
	asyncHandler((req, res, next) => {
		const adminScopes = [
			"read",
			"write_user",
			"write_post",
			"write_comment",
		];
		const memberScopes = ["read", "write_user", "write_comment"];

		const userScopes = req.query.scope.split(" ");

		const checkScopes = (defaultScopes, targetScopes) =>
			targetScopes.every(value => defaultScopes.includes(value));

		const result = req.user.isAdmin
			? checkScopes(adminScopes, userScopes)
			: checkScopes(memberScopes, userScopes);

		result
			? next()
			: res.status(400).json({
					success: false,
					message: "The scope provided is invalid.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const code = randomBytes(16).toString("hex");
		const { state, code_challenge, code_challenge_method, scope } =
			req.query;

		const newAuthCode = new AuthCode({
			session: req.session.id,
			code,
			code_challenge,
			code_challenge_method,
			scope,
		});

		await newAuthCode.save();

		res.redirect(`${process.env.REDIRECT_URL}?state=${state}&code=${code}`);
	}),
];
const authToken = [
	verifyToken,
	asyncHandler((req, res, next) => {
		res.json({
			success: true,
			message: "The token verify successfully ",
		});
	}),
];
const tokenCreate = [
	asyncHandler((req, res, next) => {
		const { code, code_verifier } = req.body;

		code && code_verifier
			? next()
			: res.status(400).json({
					success: false,
					message: "The request is missing a required parameter.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const authCode = await AuthCode.findOne({
			code: req.body.code,
		}).exec();

		const handleSetLocals = () => {
			req.authCode = authCode;
			next();
		};

		authCode
			? handleSetLocals()
			: res.status(400).json({
					success: false,
					message:
						"The provided access grant is invalid, expired, or revoked.",
			  });
	}),
	asyncHandler((req, res, next) => {
		sessionStore.get(req.authCode.session, (err, session) => {
			const handleSetLocals = async () => {
				req.user = { id: session.passport.user._id };
				next();
			};
			err
				? next(err)
				: session
				? handleSetLocals()
				: res.status(401).json({
						success: false,
						message: "The request requires higher privileges.",
				  });
		});
	}),
	asyncHandler((req, res, next) => {
		const { code_verifier } = req.body;

		generateCodeChallenge(code_verifier) === req.authCode.code_challenge
			? next()
			: res.status(400).json({
					success: false,
					message: "PKCE authentication failed.",
			  });
	}),
	asyncHandler((req, res, next) => {
		const oneMinute = 60 * 1000;

		const token = jwt.sign(
			{
				sid: req.authCode.session,
				scope: req.authCode.scope,
			},
			process.env.JWT_SECRET,
			{
				subject: req.user.id.toString(),
				issuer: process.env.ORIGIN,
				expiresIn: oneMinute,
			}
		);

		res.json({
			success: true,
			message: "Get token successfully.",
			data: {
				access_token: token,
			},
		});
	}),
];

export { authCode, authToken, tokenCreate };
