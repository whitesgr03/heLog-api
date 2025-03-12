import { expect, describe, it, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import passport from "passport";
import { createHmac } from "node:crypto";
import { Strategy as LocalStrategy } from "passport-local";

import { accountRouter } from "../../routes/account.js";

const fakeUserId = "user";
const fakeSessionId = "session";
const fakeRandomValue = "random";
const secret = process.env.CSRF_SECRETS;

const message = `${fakeSessionId.length}!${fakeSessionId}!${fakeRandomValue.length}!${fakeRandomValue}`;

const fakeHmac = createHmac("sha256", secret).update(message).digest("hex");

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
	describe("Verify CSRF token", () => {
		it("should respond with a 403 status code and message if a CSRF custom header is invalid", async () => {
			app.use(passport.authenticate("local"));
			app.use("/", accountRouter);

			const { status, body } = await request(app).post(`/logout`).send({
				username: "username",
				password: "password",
			});

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: "CSRF custom header is invalid.",
			});
		});
		it("should respond with a 403 status code and message if a CSRF custom header send by client mismatch", async () => {
			app.use("/", accountRouter);

			const { status, body } = await request(app)
				.post(`/logout`)
				.set("x-csrf-token", "123.456");

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: "CSRF token mismatch.",
			});
		});
	});
	describe("POST /logout", () => {
		it(`should response with a 500 status code and message if the user logout fails`, async () => {
			app.use((req, res, next) => {
				req.sessionID = fakeSessionId;
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

			const { status, body } = await request(app)
				.post(`/logout`)
				.set("x-csrf-token", `${fakeHmac}.${fakeRandomValue}`);
			expect(status).toBe(500);
			expect(body).toStrictEqual({
				success: false,
				message: "error",
			});
		});
		it(`should logout user`, async () => {
			app.use((req, res, next) => {
				req.sessionID = fakeSessionId;
				next();
			});
			app.use("/", accountRouter);

			const { status, body } = await request(app)
				.post(`/logout`)
				.set("x-csrf-token", `${fakeHmac}.${fakeRandomValue}`);

			expect(status).toBe(200);
			expect(body).toStrictEqual({
				success: true,
				message: "User logout successfully.",
			});
		});
	});
});
