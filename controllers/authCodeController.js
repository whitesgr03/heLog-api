import asyncHandler from "express-async-handler";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { sessionStore } from "../config/database.js";

import generateCodeChallenge from "../utils/generateCodeChallenge.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyQuery from "../middlewares/verifyQuery.js";

import AuthCode from "../models/authCode.js";
import RefreshToken from "../models/refreshToken.js";

const authCode = [
	verifyQuery,
	asyncHandler((req, res, next) => {
		const { redirect_url } = req.query;
		JSON.parse(process.env.REDIRECT_URL).includes(redirect_url)
			? next()
			: res.render("error", {
					message: "The redirect url provided is invalid.",
			  });
	}),
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
			"read_user",
			"update_user",
			"delete_user",
			"write_post",
			"delete_post",
			"update_post",
			"write_comment",
			"delete_comment",
			"update_comment",
		];
		const memberScopes = [
			"read_user",
			"update_user",
			"delete_user",
			"write_comment",
			"delete_comment",
			"update_comment",
		];

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
const tokenVerify = [
	verifyToken,
	asyncHandler((req, res, next) => {
		res.json({
			success: true,
			message: "The token verify successfully ",
		});
	}),
];

const tokenExChange = [
	asyncHandler((req, res, next) => {
		const { authorization } = req.headers;
		const token = authorization && authorization.split(" ")[1];
		const decode = token && jwt.decode(token);

		const handleSetLocals = () => {
			const { sid, rid, scope } = decode;
			req.payload = {
				sid,
			};
			rid && (req.payload.rid = rid);
			scope && (req.payload.scope = scope);

			req.token = token;
			next();
		};

		token && decode?.sid && decode?.rid && decode?.scope
			? handleSetLocals()
			: res.status(400).json({
					success: false,
					message: "The token provided is malformed.",
			  });
	}),
	asyncHandler((req, res, next) => {
		sessionStore.get(req.payload.sid, (err, session) => {
			const handleSetLocals = () => {
				req.user = {
					id: session.passport.user._id,
				};
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
	asyncHandler(async (req, res, next) => {
		const refreshToken = await RefreshToken.findById(
			req.payload.rid
		).exec();

		refreshToken
			? next()
			: res.status(401).json({
					success: false,
					message: "The token provided is revoked.",
			  });
	}),
	asyncHandler(async (req, res, next) => {
		const refreshToken = await RefreshToken.findById(
			req.payload.rid
		).exec();

		const handleLogout = async () => {
			await RefreshToken.findByIdAndDelete(req.payload.rid).exec();
			sessionStore.destroy(req.payload.sid, err =>
				err
					? next(err)
					: res.clearCookie("helog.connect.sid").status(429).json({
							success: false,
							message: "Too many token exchange requests.",
					  })
			);
		};

		Date.now() > +new Date(refreshToken.notBefore)
			? next()
			: handleLogout();
	}),
	asyncHandler((req, res, next) => {
		jwt.verify(
			req.token,
			process.env.JWT_SECRET,
			{
				subject: req.user.id,
				issuer: process.env.ORIGIN,
			},
			err => {
				err
					? res.status(401).json({
							success: false,
							message:
								"The token provided is expired, or invalid.",
					  })
					: next();
			}
		);
	}),
	asyncHandler(async (req, res, next) => {
		const oneMinute = Date.now() + 60;
		await RefreshToken.findByIdAndUpdate(req.payload.rid, {
			notBefore: new Date(oneMinute * 1000),
		}).exec();

		const access_token = jwt.sign(
			{
				sid: req.payload.session,
				scope: req.payload.scope,
				exp: oneMinute / 1000,
			},
			process.env.JWT_SECRET,
			{
				subject: req.user.id.toString(),
				issuer: process.env.ORIGIN,
			}
		);

		res.json({
			success: true,
			message: "Get access_token successfully.",
			data: {
				access_token,
			},
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
				req.user = {
					id: session.passport.user._id,
					session: {
						exp: session.cookie.expires,
					},
				};
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
	asyncHandler(async (req, res, next) => {
		const oneMinute = Date.now();

		const newRefreshToken = new RefreshToken({
			user: req.user.id,
			notBefore: new Date(oneMinute + 60 * 1000),
			expiresAfter: req.user.session.exp,
		});

		await newRefreshToken.save();

		await RefreshToken.deleteOne({
			$and: [
				{ user: req.user.id },
				{
					_id: {
						$ne: newRefreshToken._id,
					},
				},
			],
		}).exec();

		req.refreshToken = {
			id: newRefreshToken._id,
			nbf: oneMinute + 60 / 1000,
		};

		next();
	}),
	asyncHandler((req, res, next) => {
		const access_token = jwt.sign(
			{
				sid: req.authCode.session,
				scope: req.authCode.scope,
				exp: req.refreshToken.nbf,
			},
			process.env.JWT_SECRET,
			{
				subject: req.user.id.toString(),
				issuer: process.env.ORIGIN,
			}
		);
		const refresh_token = jwt.sign(
			{
				sid: req.authCode.session,
				rid: req.refreshToken.id,
				scope: req.authCode.scope,
				exp: +new Date(req.user.session.exp) / 1000,
			},
			process.env.JWT_SECRET,
			{
				subject: req.user.id.toString(),
				issuer: process.env.ORIGIN,
			}
		);

		res.json({
			success: true,
			message: "Get token successfully.",
			data: {
				session: {
					exp: req.user.session.exp,
				},
				access_token,
				refresh_token,
			},
		});
	}),
];

export { authCode, tokenCreate, tokenVerify, tokenExChange };
