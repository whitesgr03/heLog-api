import { expect, describe, it, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { faker } from "@faker-js/faker";

import { userRouter } from "../../routes/user.js";

import { User } from "../../models/user.js";
import { Post } from "../../models/post.js";
import { Comment } from "../../models/comment.js";
import { createPosts } from "../../lib/seed.js";

let app = null;

describe("User paths", () => {
	beforeEach(() => {
		app = express();
		app.use(express.json());
	});
	describe("Authenticate", () => {
		it("should respond with a 400 status code and message if the user is not logged in", async () => {
			app.use((req, res, next) => {
				req.isAuthenticated = () => false;
				next();
			});
			app.use("/", userRouter);

			const { status, body } = await request(app).get(`/posts`);

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

			app.use(async (req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: authenticatedUser._id };
				next();
			});
			app.use("/", userRouter);

			const mockPosts = await createPosts({
				users: [authenticatedUser],
				amount: 3,
			});
			const { status, body } = await request(app).get(`/posts`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get user's post list successfully.");
			expect(body.data.length).toBe(mockPosts.length);
		});
	});
	describe("GET /", () => {
		it(`should response with the authenticate user detail`, async () => {
			const authenticatedUser = await User.findOne().exec();

			app.use(async (req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: authenticatedUser._id };
				next();
			});
			app.use("/", userRouter);

			const { status, body } = await request(app).get(`/`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get user info successfully.");
			expect(body.data.username).toBe(authenticatedUser.username);
		});
	});
	describe("PATCH /", () => {
		it(`should respond with a 400 status code and error fields message if a new username is not provided`, async () => {
			const authenticatedUser = await User.findOne().exec();

			app.use(async (req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: authenticatedUser._id };
				next();
			});
			app.use("/", userRouter);

			const { status, body } = await request(app).patch(`/`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("username");
		});
		it(`should respond with a 409 status code and message if a new username exists`, async () => {
			const [firstUser, secondUser] = await User.find({}).exec();

			app.use(async (req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: firstUser._id };
				next();
			});
			app.use("/", userRouter);

			const { status, body } = await request(app)
				.patch(`/`)
				.type("json")
				.send({ username: secondUser.username });

			expect(status).toBe(409);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Username is been used.");
		});
		it(`should update the authenticate user's username to a new username`, async () => {
			const authenticatedUser = await User.findOne().exec();
			const mockNewUsername = faker.person.middleName();

			app.use(async (req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: authenticatedUser._id };
				next();
			});
			app.use("/", userRouter);

			const { status, body } = await request(app)
				.patch(`/`)
				.type("json")
				.send({ username: mockNewUsername });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update user successfully.");
			expect(body.data.username).toBe(mockNewUsername);
		});
	});
	describe("DELETE /", () => {
		it(`should delete the authenticate user and all posts and comments of that user, then log out.`, async () => {
			const authenticatedUser = await User.findOne().exec();

			app.use(async (req, res, next) => {
				req.isAuthenticated = () => true;
				req.logout = cb => cb(null);
				req.user = { id: authenticatedUser._id };
				next();
			});
			app.use("/", userRouter);

			vi.spyOn(Post, "deleteOne");
			vi.spyOn(User, "findByIdAndDelete");
			vi.spyOn(Comment, "deleteMany");
			vi.spyOn(Comment, "updateMany");

			const mockPosts = await createPosts({
				users: [authenticatedUser],
				amount: 2,
			});

			const { status, body } = await request(app).delete(`/`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Delete user successfully.");

			expect(Comment.deleteMany.mock.calls).toStrictEqual(
				mockPosts.map(item => [{ post: item._id }])
			);
			expect(Comment.deleteMany).toBeCalledTimes(mockPosts.length);
			expect(Post.deleteOne).toBeCalledTimes(mockPosts.length);
			expect(User.findByIdAndDelete)
				.toBeCalledWith(authenticatedUser._id)
				.toBeCalledTimes(1);
			expect(Comment.updateMany.mock.calls[0][0]).toStrictEqual({
				author: authenticatedUser._id,
			});
			expect(Comment.updateMany).toBeCalledTimes(1);
		});
	});
});
