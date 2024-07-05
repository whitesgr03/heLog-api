import asyncHandler from "express-async-handler";
import { randomBytes } from "node:crypto";
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
