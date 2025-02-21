import { expect, describe, it, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { Types } from "mongoose";

import { blogRouter } from "../../routes/blog.js";

import { User } from "../../models/user.js";

import {
	createPosts,
	createComments,
	createCommentReplies,
	createReplies,
} from "../../lib/seed.js";

let app = null;

describe("Reply paths", () => {
	beforeEach(() => {
		app = express();
		app.use(express.json());
	});

	describe("GET /comments/:commentId/replies", () => {
		it("should respond with empty array, if the provided comment id is invalid", async () => {
			app.use("/", blogRouter);

			const fakeCommentId = "abc123";

			const { status, body } = await request(app).get(
				`/comments/${fakeCommentId}/replies`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get all replies successfully.");
			expect(body.data).toHaveLength(0);
		});
		it("should return with a specified comment's replies", async () => {
			const users = await User.find({}).exec();

			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users,
				amount: 1,
			});
			const mockComments = await createComments({
				users,
				posts: mockPosts,
				amount: 1,
			});
			const mockCommentReplies = await createCommentReplies({
				users,
				comments: mockComments,
				amount: 10,
			});

			const mockCommentId = String(mockComments[0]._id);

			const { status, body } = await request(app).get(
				`/comments/${mockCommentId}/replies`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get all replies successfully.");
			expect(body.data.length).toBe(mockCommentReplies.length);
			body.data.forEach(reply => {
				expect(reply.parent).toBe(mockCommentId);
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
	describe("POST /comments/:commentId/replies", () => {
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
				.send({ test: "new content" });

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
				.post(`/comments/${fakeCommentId}/replies`)
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
				.post(`/comments/${fakeCommentId}/replies`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it("should create a comment's reply and return to client", async () => {
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
			const mockComments = await createComments({
				users: [secondUser],
				posts: mockPosts,
				amount: 1,
			});

			const secondUserCommentId = String(mockComments[0]._id);
			const mockContent = "new content";

			const { status, body } = await request(app)
				.post(`/comments/${secondUserCommentId}/replies`)
				.type("json")
				.send({ content: mockContent });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Create comment successfully.");

			expect(body.data.author.username).toBe(authenticatedUser.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(secondUserCommentId);
			expect(body.data.content).toBe(mockContent);
		});
	});
	describe("POST /replies/:replyId", () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const { status, body } = await request(app)
				.post(`/replies/test123`)
				.type("json")
				.send({ text: "new content" });

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("content");
		});
		it(`should respond with a 404 status code and an error message, if the provided reply id is invalid`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeReplyId = "abc123";

			const { status, body } = await request(app)
				.post(`/replies/${fakeReplyId}`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Reply could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeReplyId = new Types.ObjectId();

			const { status, body } = await request(app)
				.post(`/replies/${fakeReplyId}`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Reply could not be found.");
		});
		it("should create a reply that is a comment on that other reply.", async () => {
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
			const mockComments = await createComments({
				users: [authenticatedUser],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [secondUser],
				comments: mockComments,
				amount: 1,
			});

			const secondUserReplyId = String(mockCommentReplies[0]._id);

			const mockContent = "new content";

			const { status, body } = await request(app)
				.post(`/replies/${secondUserReplyId}`)
				.type("json")
				.send({ content: mockContent });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Create reply successfully.");

			expect(body.data.author.username).toBe(authenticatedUser.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.reply._id).toBe(secondUserReplyId);
			expect(body.data.content).toBe(mockContent);
		});
	});
	describe("PATCH /replies/:replyId", () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const { status, body } = await request(app)
				.patch(`/replies/test123`)
				.type("json")
				.send({ text: "new content" });

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("content");
		});
		it(`should respond with a 404 status code and an error message, if the provided reply id is invalid`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeReplyId = "abc123";

			const { status, body } = await request(app)
				.patch(`/replies/${fakeReplyId}`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Reply could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeReplyId = new Types.ObjectId();

			const { status, body } = await request(app)
				.patch(`/replies/${fakeReplyId}`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Reply could not be found.");
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the reply nor the blog admin`, async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [admin],
				comments: mockComments,
				amount: 1,
			});

			const adminReplyId = String(mockCommentReplies[0]._id);

			const { status, body } = await request(app)
				.patch(`/replies/${adminReplyId}`)
				.type("json")
				.send({ content: "new content" });

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe(
				"This request requires higher permissions."
			);
		});
		it("should successfully updated comment's reply and return to client, if the authenticate user is a blog admin", async () => {
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
				users: [admin],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [user],
				comments: mockComments,
				amount: 1,
			});

			const userReplyId = String(mockCommentReplies[0]._id);

			const mockContent =
				"This message is updated by admin not second user";

			const { status, body } = await request(app)
				.patch(`/replies/${userReplyId}`)
				.type("json")
				.send({
					content: mockContent,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update reply successfully.");

			expect(body.data.author.username).not.toBe(admin.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
		it("should successfully updated comment's reply and return to client, if the authenticate user is owner of the comment's reply", async () => {
			const [firstUser, secondUser] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: secondUser._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [secondUser],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [firstUser],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [secondUser],
				comments: mockComments,
				amount: 1,
			});

			const secondUserReplyId = String(mockCommentReplies[0]._id);

			const mockContent = "This message is updated by owner";

			const { status, body } = await request(app)
				.patch(`/replies/${secondUserReplyId}`)
				.type("json")
				.send({
					content: mockContent,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update reply successfully.");

			expect(body.data.author.username).toBe(secondUser.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
		it("should successfully updated reply and return to client, if the authenticate user is owner of the reply", async () => {
			const [firstUser, secondUser] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: secondUser._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [firstUser],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [secondUser],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [firstUser],
				comments: mockComments,
				amount: 1,
			});

			const mockReplies = await createReplies({
				users: [secondUser],
				commentReplies: mockCommentReplies,
				amount: 1,
			});

			const secondUserReplyId = String(mockReplies[0]._id);

			const mockContent = "This message is updated by owner";

			const { status, body } = await request(app)
				.patch(`/replies/${secondUserReplyId}`)
				.type("json")
				.send({
					content: mockContent,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update reply successfully.");

			expect(body.data.author.username).toBe(secondUser.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.reply._id).toBe(String(mockCommentReplies[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
	});
	describe("DELETE /replies/:replyId", () => {
		it(`should respond with a 404 status code and an error message, if the provided reply id is invalid`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeReplyId = "abc123";

			const { status, body } = await request(app).delete(
				`/replies/${fakeReplyId}`
			);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Reply could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakeReplyId = new Types.ObjectId();

			const { status, body } = await request(app).delete(
				`/replies/${fakeReplyId}`
			);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Reply could not be found.");
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the reply nor the blog admin`, async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [admin],
				comments: mockComments,
				amount: 1,
			});

			const adminReplyId = String(mockCommentReplies[0]._id);

			const { status, body } = await request(app).delete(
				`/replies/${adminReplyId}`
			);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe(
				"This request requires higher permissions."
			);
		});
		it("should successfully delete reply and return to client, if the authenticate user is a blog admin", async () => {
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
				users: [admin],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [user],
				comments: mockComments,
				amount: 1,
			});

			const userReplyId = String(mockCommentReplies[0]._id);

			const editor = String(admin._id);

			const { status, body } = await request(app).delete(
				`/replies/${userReplyId}`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Delete reply successfully.");

			expect(body.data.author).not.toBe(editor);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe("Reply deleted by admin");
			expect(body.data.deleted).toBe(true);
		});
		it("should successfully delete reply and return to client, if the authenticate user is owner of the reply", async () => {
			const [firstUser, secondUser] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: secondUser._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [secondUser],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [firstUser],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [secondUser],
				comments: mockComments,
				amount: 1,
			});

			const secondUserReplyId = String(mockCommentReplies[0]._id);

			const { status, body } = await request(app).delete(
				`/replies/${secondUserReplyId}`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Delete reply successfully.");

			expect(body.data.author).toBe(String(secondUser._id));
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe("Reply deleted by user");
			expect(body.data.deleted).toBe(true);
		});
	});
});
