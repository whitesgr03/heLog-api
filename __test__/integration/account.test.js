import { expect, describe, it } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { passport } from "../../lib/passport.js";

import { accountRouter } from "../../routes/account.js";

import { generateCSRFToken } from "../../utils/generateCSRFToken.js";

const app = express();
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

app.get("/login", (req, res, next) => {
	req.body = {
		admin: req.query.isAdmin ?? "1",
		_: " ",
	};
	passport.authenticate("local", (_err, user) => {
		req.login(user, () => {
			res.send({
				token: generateCSRFToken(req.sessionID),
			});
		});
	})(req, res, next);
});
app.use("/", accountRouter);

describe("Account paths", () => {
	describe("Authenticate", () => {
		it("should respond with a 400 status code and message if the user is not logged in", async () => {
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
			const agent = request.agent(app);

			await agent.get(`/login`);

			const { status, body } = await agent.post(`/logout`);

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: "CSRF custom header is invalid.",
			});
		});
		it("should respond with a 403 status code and message if a CSRF custom header send by client mismatch", async () => {
			const agent = request.agent(app);

			await agent.get(`/login`);

			const { status, body } = await agent
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
			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.post(`/logout`)
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(200);
			expect(body).toStrictEqual({
				success: true,
				message: "User logout successfully.",
			});
		});
	});
});
