import { expect, describe, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { faker } from "@faker-js/faker";
import session from "express-session";

import { userRouter } from "../../routes/user.js";

import { generateCSRFToken } from "../../utils/generateCSRFToken.js";

import { User } from "../../models/user.js";
import { Post } from "../../models/post.js";
import { Comment } from "../../models/comment.js";

import { createPosts } from "../../lib/seed.js";
import { passport } from "../../lib/passport.js";

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

app.use("/", userRouter);

describe("User paths", () => {
	describe("Authenticate", () => {
		it("should respond with a 400 status code and message if the user is not logged in", async () => {
			const { status, body } = await request(app).get(`/`);

			expect(status).toBe(404);
			expect(body).toStrictEqual({
				success: false,
				message: "User could not been found.",
			});
		});
	});
	describe("GET /posts", () => {
		it(`should response with all posts of the authenticate user`, async () => {
			const authenticatedUser = await User.findOne().exec();

			const mockPosts = await createPosts({
				users: [authenticatedUser],
				amount: 3,
			});

			const agent = request.agent(app);

			await agent.get(`/login`);

			const { status, body } = await agent.get(`/posts`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get user's post list successfully.");
			expect(body.data.length).toBe(mockPosts.length);
		});
	});
	describe("Verify CSRF token", () => {
		it("should respond with a 403 status code and message if a CSRF custom header is invalid", async () => {
			const agent = request.agent(app);

			await agent.get(`/login`);

			const { status, body } = await agent.get(`/`);

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
				.get(`/`)
				.set("x-csrf-token", "123.456");

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: "CSRF token mismatch.",
			});
		});
	});
	describe("GET /", () => {
		it(`should response with the authenticate user detail`, async () => {
			const authenticatedUser = await User.findOne().exec();

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.get(`/`)
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get user info successfully.");
			expect(body.data.username).toBe(authenticatedUser.username);
			expect(body.data.isAdmin).toBe(authenticatedUser.isAdmin);
			expect(body.data.email).toBe(authenticatedUser.email);
		});
	});
	describe("PATCH /", () => {
		it(`should respond with a 400 status code and error fields message if a new username is not provided`, async () => {
			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/`)
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("username");
		});
		it(`should respond with a 409 status code and message if a new username exists`, async () => {
			const [, secondUser] = await User.find({}).exec();

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/`)
				.type("json")
				.send({ username: secondUser.username })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(409);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Username is been used.");
		});
		it(`should update the authenticate user's username to a new username`, async () => {
			const mockNewUsername = faker.person.middleName();

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/`)
				.type("json")
				.send({ username: mockNewUsername })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update user successfully.");
			expect(body.data.username).toBe(mockNewUsername);
		});
	});
	describe("DELETE /", () => {
		it(`should delete the authenticate user and all posts and comments of that user, then log out.`, async () => {
			const user = await User.findOne().exec();

			vi.spyOn(Post, "deleteOne");
			vi.spyOn(User, "findByIdAndDelete");
			vi.spyOn(Comment, "deleteMany");
			vi.spyOn(Comment, "updateMany");

			const mockPosts = await createPosts({
				users: [user],
				amount: 2,
			});
			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.delete(`/`)
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Delete user successfully.");

			expect(Comment.deleteMany.mock.calls).toStrictEqual(
				mockPosts.map(item => [{ post: item._id }])
			);
			expect(Comment.deleteMany).toBeCalledTimes(mockPosts.length);
			expect(Post.deleteOne).toBeCalledTimes(mockPosts.length);
			expect(User.findByIdAndDelete)
				.toBeCalledWith(`${user._id}`)
				.toBeCalledTimes(1);
			expect(Comment.updateMany.mock.calls[0][0]).toStrictEqual({
				author: `${user._id}`,
			});
			expect(Comment.updateMany).toBeCalledTimes(1);
		});
	});
});
