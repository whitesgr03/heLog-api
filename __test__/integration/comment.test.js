import { expect, describe, it, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { Types } from "mongoose";

import { blogRouter } from "../../routes/blog.js";

import { User } from "../../models/user.js";

import { createPosts, createComments } from "../../lib/seed.js";

let app = null;

describe("Comment paths", () => {
	beforeEach(() => {
		app = express();
		app.use(express.json());
	});

	describe("GET /posts/:postId/comments", () => {
		it("should respond with empty array, if the provided comment id is invalid", async () => {
			app.use("/", blogRouter);

			const fakePostId = "abc123";

			const { status, body } = await request(app).get(
				`/posts/${fakePostId}/comments`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get all comments successfully.");
			expect(body.data).toHaveLength(0);
		});
		it("should return all comments for the specified post", async () => {
			const users = await User.find({}).exec();

			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users,
				amount: 1,
			});
			const mockComments = await createComments({
				users,
				posts: mockPosts,
				amount: 10,
			});

			const mockPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app).get(
				`/posts/${mockPostId}/comments`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get all comments successfully.");
			expect(body.data.length).toBe(mockComments.length);
			body.data.forEach(comment => {
				expect(comment.post).toBe(mockPostId);
			});
		});
	});
	describe("Authenticate", () => {
		it("should respond with a 400 status code and message if the user is not logged in", async () => {
			app.use((req, res, next) => {
				req.isAuthenticated = () => false;
				next();
			});
			app.use("/", blogRouter);
			const { status, body } = await request(app).post(`/posts`);
			expect(status).toBe(404);
			expect(body).toStrictEqual({
				success: false,
				message: "User could not been found.",
			});
		});
	});
	describe("POST /posts/:postId/comments", () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const { status, body } = await request(app)
				.post(`/comments/test-id/replies`)
				.send({ text: "new content" });

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("content");
		});
		it(`should respond with a 404 status code and an error message, if the provided post id is invalid`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakePostId = "abc123";

			const { status, body } = await request(app)
				.post(`/posts/${fakePostId}/comments`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Post could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified post is not found`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakePostId = new Types.ObjectId();

			const { status, body } = await request(app)
				.post(`/posts/${fakePostId}/comments`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Post could not be found.");
		});
		it("should create a comment and return to client", async () => {
			const [authenticatedUser, secondUser] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: authenticatedUser._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [secondUser],
				amount: 1,
			});

			const secondUserPostId = String(mockPosts[0]._id);
			const mockContent = "new content";

			const { status, body } = await request(app)
				.post(`/posts/${secondUserPostId}/comments`)
				.type("json")
				.send({ content: mockContent });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Create comment successfully.");

			expect(body.data.author.username).toBe(authenticatedUser.username);
			expect(body.data.post).toBe(secondUserPostId);
			expect(body.data.content).toBe(mockContent);
		});
	});
	describe("PATCH /comments/:commentId", () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const { status, body } = await request(app)
				.patch(`/comments/test123`)
				.type("json")
				.send({ text: "new content" });

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("content");
		});
		it(`should respond with a 404 status code and an error message, if the provided comment id is invalid`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeCommentId = "abc123";

			const { status, body } = await request(app)
				.patch(`/comments/${fakeCommentId}`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified comment is not found`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeCommentId = new Types.ObjectId();

			const { status, body } = await request(app)
				.patch(`/comments/${fakeCommentId}`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the comment nor the blog admin`, async () => {
			const [admin, user] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [admin],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [admin],
				posts: mockPosts,
				amount: 1,
			});

			const adminCommentId = String(mockComments[0]._id);

			const { status, body } = await request(app)
				.patch(`/comments/${adminCommentId}`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe(
				"This request requires higher permissions."
			);
		});
		it("should successfully updated a specified comment and return to client, if the authenticate user is a blog admin", async () => {
			const [admin, user] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: admin._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [user],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const userCommentId = String(mockComments[0]._id);

			const mockContent = "This message is updated by admin not user";

			const { status, body } = await request(app)
				.patch(`/comments/${userCommentId}`)
				.type("json")
				.send({
					content: mockContent,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update comment successfully.");

			expect(body.data.author.username).not.toBe(admin.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
		it("should successfully updated a specified comment and return to client, if the authenticate user is owner of the comment", async () => {
			const [admin, user] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [admin],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const userCommentId = String(mockComments[0]._id);

			const mockContent = "This message is updated by owner";

			const { status, body } = await request(app)
				.patch(`/comments/${userCommentId}`)
				.type("json")
				.send({
					content: mockContent,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update comment successfully.");

			expect(body.data.author.username).toBe(user.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
	});
	describe("DELETE/comments/:commentId", () => {
		it(`should respond with a 404 status code and an error message, if the provided comment id is invalid`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeCommentId = "abc123";

			const { status, body } = await request(app).delete(
				`/comments/${fakeCommentId}`
			);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeCommentId = new Types.ObjectId();

			const { status, body } = await request(app).delete(
				`/comments/${fakeCommentId}`
			);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the comment nor the blog admin`, async () => {
			const [admin, user] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [user],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [admin],
				posts: mockPosts,
				amount: 1,
			});

			const adminCommentId = String(mockComments[0]._id);

			const { status, body } = await request(app).delete(
				`/comments/${adminCommentId}`
			);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe(
				"This request requires higher permissions."
			);
		});
		it("should successfully delete a specified comment and return to client, if the authenticate user is a blog admin", async () => {
			const [admin, user] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: admin._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [admin],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const userCommentId = String(mockComments[0]._id);

			const editor = String(admin._id);

			const { status, body } = await request(app).delete(
				`/comments/${userCommentId}`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Delete comment successfully.");

			expect(body.data.author).not.toBe(editor);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe("Comment deleted by admin");
			expect(body.data.deleted).toBe(true);
		});
		it("should successfully delete a specified comment and return to client, if the authenticate user is owner of the comment", async () => {
			const [admin, user] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [admin],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const userCommentId = String(mockComments[0]._id);

			const { status, body } = await request(app).delete(
				`/comments/${userCommentId}`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Delete comment successfully.");

			expect(body.data.author).toBe(String(user._id));
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe("Comment deleted by user");
			expect(body.data.deleted).toBe(true);
		});
	});
});
