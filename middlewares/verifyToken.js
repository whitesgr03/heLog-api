import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";

import { sessionStore } from "../config/database.js";

const verifyToken = [
	asyncHandler((req, res, next) => {
		const { authorization } = req.headers;
		const token = authorization && authorization.split(" ")[1];
		const handleSetLocals = () => {
			const decode = jwt.decode(token);

			req.payload = {
				sid: decode?.sid,
				scope: decode?.scope,
			};
			req.token = token;
			next();
		};

		token
			? handleSetLocals()
			: res.status(400).json({
					success: false,
					message: "The access token provided is malformed.",
			  });
	}),
	asyncHandler((req, res, next) => {
		sessionStore.get(req.payload.sid, (err, session) => {
			const handleSetLocals = () => {
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
		jwt.verify(
			req.token,
			process.env.JWT_SECRET,
			{
				subject: req.user.id,
				issuer: process.env.ORIGIN,
			},
			err => {
				err || !req.payload.scope
					? res.status(401).json({
							success: false,
							message:
								"The access token provided is expired, or invalid for other reasons.",
					  })
					: next();
			}
		);
	}),
];

export default verifyToken;
