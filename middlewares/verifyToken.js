import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";

import { sessionStore } from "../config/database.js";

const verifyToken = [
	asyncHandler((req, res, next) => {
		const { authorization } = req.headers;
		const token = authorization && authorization.split(" ")[1];
		const decode = token && jwt.decode(token);

		const handleSetLocals = () => {
			const { sid } = decode;
			req.payload = {
				sid,
			};

			req.token = token;
			next();
		};

		token && decode?.sid && !decode?.rid
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
	asyncHandler((req, res, next) => {
		jwt.verify(
			req.token,
			process.env.JWT_SECRET,
			{
				subject: req.user.id,
				issuer: process.env.HELOG_API_URL,
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
];

export default verifyToken;
