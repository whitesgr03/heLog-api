import { expect, describe, it } from "vitest";
import request from "supertest";
import express from "express";
import { Types } from "mongoose";
import session from "express-session";

import { blogRouter } from "../../routes/blog.js";

import { generateCSRFToken } from "../../utils/generateCSRFToken.js";

import { User } from "../../models/user.js";

import { createPosts, createComments } from "../../lib/seed.js";
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

app.use("/", blogRouter);

describe("Comment paths", () => {
	describe("GET /posts/:postId/comments", () => {
		it("should respond with empty array, if the provided comment id is invalid", async () => {
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
			const { status, body } = await request(app).post(
				`/posts/testId/comments`
			);
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

			const { status, body } = await agent.post(`/posts/testId/comments`);

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
				.post(`/posts/testId/comments`)
				.set("x-csrf-token", "123.456");

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: "CSRF token mismatch.",
			});
		});
	});
	describe("POST /posts/:postId/comments", () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.post(`/comments/test-id/replies`)
				.send({ text: "new content" })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("content");
		});
		it(`should respond with a 404 status code and an error message, if the provided post id is invalid`, async () => {
			const fakePostId = "abc123";

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.post(`/posts/${fakePostId}/comments`)
				.type("json")
				.send({ content: "new content" })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Post could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified post is not found`, async () => {
			const fakePostId = new Types.ObjectId();

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.post(`/posts/${fakePostId}/comments`)
				.type("json")
				.send({ content: "new content" })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Post could not be found.");
		});
		it("should create a comment and return to client", async () => {
			const [authenticatedUser, secondUser] = await User.find({}).exec();

			const mockPosts = await createPosts({
				users: [secondUser],
				amount: 1,
			});

			const secondUserPostId = String(mockPosts[0]._id);
			const mockContent = "new content";

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.post(`/posts/${secondUserPostId}/comments`)
				.type("json")
				.send({ content: mockContent })
				.set("x-csrf-token", `${token}.${value}`);

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
			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/comments/test123`)
				.type("json")
				.send({ text: "new content" })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("content");
		});
		it(`should respond with a 404 status code and an error message, if the provided comment id is invalid`, async () => {
			const fakeCommentId = "abc123";

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/comments/${fakeCommentId}`)
				.type("json")
				.send({ content: "new content" })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified comment is not found`, async () => {
			const fakeCommentId = new Types.ObjectId();

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/comments/${fakeCommentId}`)
				.type("json")
				.send({ content: "new content" })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the comment nor the blog admin`, async () => {
			const [admin] = await User.find({}).exec();

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

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login?isAdmin=0`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/comments/${adminCommentId}`)
				.type("json")
				.send({ content: "new content" })
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe(
				"This request requires higher permissions."
			);
		});
		it("should successfully updated a specified comment and return to client, if the authenticate user is a blog admin", async () => {
			const [admin, user] = await User.find({}).exec();

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

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/comments/${userCommentId}`)
				.type("json")
				.send({
					content: mockContent,
				})
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update comment successfully.");

			expect(body.data.author.username).not.toBe(admin.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
		it("should successfully updated a specified comment and return to client, if the authenticate user is owner of the comment", async () => {
			const [admin, user] = await User.find({}).exec();

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

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.patch(`/comments/${userCommentId}`)
				.type("json")
				.send({
					content: mockContent,
				})
				.set("x-csrf-token", `${token}.${value}`);

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
			const fakeCommentId = "abc123";

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.delete(`/comments/${fakeCommentId}`)
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const fakeCommentId = new Types.ObjectId();

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.delete(`/comments/${fakeCommentId}`)
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Comment could not be found.");
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the comment nor the blog admin`, async () => {
			const [admin, user] = await User.find({}).exec();

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

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login?isAdmin=0`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.delete(`/comments/${adminCommentId}`)
				.set("x-csrf-token", `${token}.${value}`);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe(
				"This request requires higher permissions."
			);
		});
		it("should successfully delete a specified comment and return to client, if the authenticate user is a blog admin", async () => {
			const [admin, user] = await User.find({}).exec();

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

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.delete(`/comments/${userCommentId}`)
				.set("x-csrf-token", `${token}.${value}`);

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

			const agent = request.agent(app);

			const loginResponse = await agent.get(`/login?isAdmin=0`);

			const [token, value] = loginResponse.body.token.split(".");

			const { status, body } = await agent
				.delete(`/comments/${userCommentId}`)
				.set("x-csrf-token", `${token}.${value}`);

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
