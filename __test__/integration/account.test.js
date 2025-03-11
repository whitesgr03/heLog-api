import { expect, describe, it, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

import { accountRouter } from "../../routes/account.js";
passport.use(
	new LocalStrategy((_username, _password, done) => {
		done(null, { id: fakeUserId });
	})
);

passport.serializeUser((user, done) => {
	done(null, user);
});

let app = null;

describe("Account paths", () => {
	beforeEach(() => {
		app = express();
		app.use(
			session({
				secret: "secret",
				resave: false,
				saveUninitialized: false,
				name: "id",
			})
		);
		app.use(passport.session());
		app.use(express.json());
	});
	describe("Authenticate", () => {
		it("should respond with a 400 status code and message if the user is not logged in", async () => {
			app.use("/", accountRouter);

			const { status, body } = await request(app).post(`/logout`);

			expect(status).toBe(404);
			expect(body).toStrictEqual({
				success: false,
				message: "User could not been found.",
			});
		});
	});
		});
	});
	describe("POST /logout", () => {
		it(`should response with a 500 status code and message if the user logout fails`, async () => {
			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.logout = cb =>
					cb({
						status: 500,
						message: "error",
					});
				next();
			});
			app.use("/", accountRouter);
			/* eslint-disable no-unused-vars */
			app.use((err, req, res, next) => {
				/* eslint-enable */
				res.status(err.status).json({
					success: false,
					message: err.message,
				});
			});

			const { status, body } = await request(app).post(`/logout`);

			expect(status).toBe(500);
			expect(body).toStrictEqual({
				success: false,
				message: "error",
			});
		});
		it(`should logout user`, async () => {
			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.logout = cb => cb(null);
				next();
			});
			app.use("/", accountRouter);

			const { status, body } = await request(app).post(`/logout`);

			expect(status).toBe(200);
			expect(body).toStrictEqual({
				success: true,
				message: "User logout successfully.",
			});
		});
	});
});
