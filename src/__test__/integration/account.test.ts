import { expect, describe, it } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { passport } from "../../lib/passport.js";

import { User } from "../../models/user.js";
import { UserDocument } from "../../models/user.js";

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

app.post("/login", (req, res, next) => {
	req.body = {
		...req.body,
		password: " ",
	};
	passport.authenticate("local", (_err: any, user: Express.User) => {
		user
			? req.login(user, () => {
					res.send({
						token: generateCSRFToken(req.sessionID),
					});
			  })
			: res.status(404).send({
					message: "The user is not found.",
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
		it("should respond with a 403 status code and message if a CSRF token is not provided", async () => {
			const user = (await User.findOne({}).exec()) as UserDocument;

			const agent = request.agent(app);

			await agent.post(`/login`).send({ username: user.username });

			const { status, body } = await agent.post(`/logout`);

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: "CSRF token mismatch.",
			});
		});
		it("should respond with a 403 status code and message if a CSRF token send by client but mismatch", async () => {
			const user = (await User.findOne({}).exec()) as UserDocument;
			const agent = request.agent(app);

			await agent.post(`/login`).send({ username: user.username });

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
		it(`should logout user`, async () => {
			const user = (await User.findOne({}).exec()) as UserDocument;
			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ username: user.username });

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
