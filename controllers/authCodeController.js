import jwt from "jsonwebtoken";
import debug from "debug";
import asyncHandler from "express-async-handler";
import { randomBytes } from "node:crypto";
import { sessionStore } from "../config/database.js";

import verifyToken from "../middlewares/verifyToken.js";
import verifyQuery from "../middlewares/verifyQuery.js";
import generateCodeChallenge from "../utils/generateCodeChallenge.js";

import AuthCode from "../models/authCode.js";
import RefreshToken from "../models/refreshToken.js";

const serverLog = debug("Server");

const authCode = [
	verifyQuery,
	asyncHandler((req, res, next) => {
		const { redirect_url } = req.query;

		const handleError = () => {
			serverLog("The redirect url provided is invalid.");
			res.render("error");
		};

		process.env.REDIRECT_URL.split(",").includes(redirect_url)
			? next()
			: handleError();
	}),
	asyncHandler((req, res, next) => {
		const {
			state,
			code_challenge,
			code_challenge_method,
			redirect_url,
			darkTheme,
		} = req.query;
		const queries =
			`state=${state}` +
			`&code_challenge=${code_challenge}` +
			`&code_challenge_method=${code_challenge_method}` +
			`&redirect_url=${redirect_url}` +
			`&darkTheme=${darkTheme}`;

		req.isAuthenticated()
			? next()
			: res.redirect(`/account/login?${queries}`);
	}),
	asyncHandler(async (req, res, next) => {
		const code = randomBytes(16).toString("hex");
		const { state, code_challenge, code_challenge_method, redirect_url } =
			req.query;

		const newAuthCode = new AuthCode({
			session: req.session.id,
			code,
			code_challenge,
			code_challenge_method,
		});

		await newAuthCode.save();

		res.redirect(`${redirect_url}?state=${state}&code=${code}`);
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
			const { sid, rid } = decode;
			req.payload = {
				sid,
				rid,
			};
			req.token = token;
			next();
		};

		token && decode?.sid && decode?.rid
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

		req.refreshToken = refreshToken;

		const handleLogout = async () => {
			await refreshToken.deleteOne();

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
					? err.name === "TokenExpiredError"
						? res.status(401).json({
								success: false,
								message: "The token provided is expired.",
						  })
						: res.status(401).json({
								success: false,
								message: "The token provided is invalid.",
						  })
					: next();
			}
		);
	}),
	asyncHandler(async (req, res, next) => {
		const currentTime = Date.now();

		req.refreshToken.notBefore = new Date(currentTime + 60 * 1000);

		await req.refreshToken.save();

		const access_token = jwt.sign(
			{
				sid: req.payload.sid,
				exp: Math.floor(currentTime / 1000) + 60,
			},
			process.env.JWT_SECRET,
			{
				subject: req.user.id,
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
					message: "The provided access grant is invalid or expired.",
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
		sessionStore.get(req.authCode.session, (err, session) => {
			const handleSetLocals = () => {
				req.user = {
					id: session.passport.user._id,
					session: {
						exp: new Date(session.cookie.expires),
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
	asyncHandler(async (req, res, next) => {
		const refreshToken = await RefreshToken.findOne({
			user: req.user.id,
		}).exec();

		const currentTime = Date.now();
		const unixTime = Math.floor(currentTime / 1000);

		let data = {
			session: {
				exp: req.user.session.exp,
			},
		};

		const handleCreateRefreshToken = async () => {
			const newRefreshToken = new RefreshToken({
				user: req.user.id,
				notBefore: new Date(currentTime + 60 * 1000),
				expiresAfter: req.user.session.exp,
			});

			data.access_token = jwt.sign(
				{
					sid: req.authCode.session,
					exp: unixTime + 60,
				},
				process.env.JWT_SECRET,
				{
					subject: req.user.id,
					issuer: process.env.ORIGIN,
				}
			);
			data.refresh_token = jwt.sign(
				{
					rid: newRefreshToken._id,
					sid: req.authCode.session,
					exp:
						unixTime +
						(req.user.session.exp.getTime() - currentTime) / 1000,
				},
				process.env.JWT_SECRET,
				{
					subject: req.user.id,
					issuer: process.env.ORIGIN,
				}
			);

			newRefreshToken.token = data.refresh_token;

			await newRefreshToken.save();
		};
		const handleCreateAccessToken = () => {
			data.access_token = jwt.sign(
				{
					sid: req.authCode.session,
					exp:
						unixTime +
						(new Date(refreshToken.notBefore).getTime() -
							currentTime) /
							1000,
				},
				process.env.JWT_SECRET,
				{
					subject: req.user.id,
					issuer: process.env.ORIGIN,
				}
			);
			data.refresh_token = refreshToken.token;
		};

		refreshToken
			? handleCreateAccessToken()
			: await handleCreateRefreshToken();

		res.json({
			success: true,
			message: "Get token successfully.",
			data,
		});
	}),
];

export { authCode, tokenCreate, tokenVerify, tokenExChange };
