import { expect, describe, it, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { Types } from "mongoose";
import { faker } from "@faker-js/faker";

import { blogRouter } from "../../routes/blog.js";

import { User } from "../../models/user.js";
import { Comment } from "../../models/comment.js";
import { Post } from "../../models/post.js";

import { createPosts, createComments } from "../../lib/seed.js";

let app = null;

describe("Comment paths", () => {
	beforeEach(() => {
		app = express();
		app.use(express.json());
	});

	describe("GET /posts", () => {
		it("should respond with empty array, if there are not posts", async () => {
			app.use("/", blogRouter);

			const { status, body } = await request(app).get(`/posts`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get all posts successfully.");
			expect(body.data.posts.length).toBe(0);
			expect(body.data.countPosts).toBe(0);
		});
		it("should return all posts", async () => {
			const users = await User.find({}).exec();

			app.use("/", blogRouter);

			const amount = 5;

			const mockPosts = await createPosts({
				users,
				amount,
			});

			const { status, body } = await request(app).get(`/posts`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get all posts successfully.");
			expect(body.data.posts.length).toBe(mockPosts.length);
			expect(body.data.countPosts).toBe(amount);
		});
	});
	describe("GET /posts/:postId", () => {
		it(`should respond with a 404 status code and an error message, if the provided post id is invalid`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakePostId = "abc123";

			const { status, body } = await request(app).get(
				`/posts/${fakePostId}`
			);

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

			const { status, body } = await request(app).get(
				`/posts/${fakePostId}`
			);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Post could not be found.");
		});
		it("should return a specified post detail", async () => {
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
				amount: 10,
			});

			const userPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app).get(
				`/posts/${userPostId}`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get post successfully.");

			expect(body.data._id).toBe(userPostId);
			expect(body.data.countComments).toBe(mockComments.length);
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
	describe("POST /posts", () => {
		it(`should respond with a 400 status code and an error field message, if the length of title value is greater then 100`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const { status, body } = await request(app)
				.post(`/posts`)
				.send({ title: faker.string.nanoid(105) });

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("title");
		});
		it(`should respond with a 400 status code and an error field message, if the length of content value is greater then 8000`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const { status, body } = await request(app)
				.post(`/posts`)
				.send({ content: `<p>${faker.string.nanoid(8005)}</p>` });

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("content");
		});
		it("should create a post and return to client", async () => {
			const [user] = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const mockData = {
				title: "new title",
				mainImage: faker.image.url(),
				content: "new content",
			};

			const { status, body } = await request(app)
				.post(`/posts`)
				.type("json")
				.send(mockData);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Create post successfully.");

			expect(body.data.title).toBe(mockData.title);
			expect(body.data.mainImage).toBe(mockData.mainImage);
			expect(body.data.content).toBe(mockData.content);
		});
	});
	describe("PATCH /posts/:postId", () => {
		it(`should respond with a 400 status code and the error field message, if the value of publish is not provided`, async () => {
			const user = await User.findOne().exec();

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

			const userPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app)
				.patch(`/posts/${userPostId}`)
				.type("json")
				.send({
					title: "new title",
					content: "new content",
					mainImage: "new image resource url",
				});

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("publish");
		});
		it(`should respond with a 400 status code and the message for each error fields, if all required fields are not provided when the value of publish is true`, async () => {
			const user = await User.findOne().exec();

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

			const userPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app)
				.patch(`/posts/${userPostId}`)
				.type("json")
				.send({ publish: true });

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty("title");
			expect(body.fields).toHaveProperty("mainImage");
			expect(body.fields).toHaveProperty("content");
		});
		it(`should respond with a 400 status code and an error field message, if the length of content value is greater then 8000`, async () => {
			const user = await User.findOne().exec();

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

			const userPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app)
				.patch(`/posts/${userPostId}`)
				.send({
					content: `<p>${faker.string.nanoid(8005)}</p>`,
				});

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

			const fakePostId = "123abc";

			const { status, body } = await request(app)
				.patch(`/posts/${fakePostId}`)
				.type("json")
				.send({
					title: "new title",
					content: "new content",
					mainImage: "new image resource url",
					publish: true,
				});

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
				.patch(`/posts/${fakePostId}`)
				.type("json")
				.send({
					title: "new title",
					content: "new content",
					mainImage: "new image resource url",
					publish: true,
				});

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Post could not be found.");
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the post nor the blog admin`, async () => {
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

			const adminPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app)
				.patch(`/posts/${adminPostId}`)
				.type("json")
				.send({
					title: "new title",
					content: "new content",
					mainImage: "new image resource url",
					publish: true,
				});

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe(
				"This request requires higher permissions."
			);
		});
		it("should successfully updated a specified post and return to client, if the authenticate user is a blog admin", async () => {
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

			const userPostId = String(mockPosts[0]._id);

			const mockData = {
				title: "new title",
				content: "new content",
				mainImage: "new image resource url",
				publish: false,
			};

			const { status, body } = await request(app)
				.patch(`/posts/${userPostId}`)
				.type("json")
				.send(mockData);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update post successfully.");

			expect(body.data.title).toBe(mockData.title);
			expect(body.data.content).toBe(mockData.content);
			expect(body.data.mainImage).toBe(mockData.mainImage);
			expect(body.data.publish).toBe(mockData.publish);
		});
		it("should successfully updated a specified post and return to client, if the authenticate user is owner of the post", async () => {
			const users = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: users[1]._id };
				next();
			});
			app.use("/", blogRouter);

			const mockPosts = await createPosts({
				users: [users[1]],
				amount: 1,
			});

			const userPostId = String(mockPosts[0]._id);

			const mockData = {
				title: "new title",
				content: "new content",
				mainImage: "new image resource url",
				publish: false,
			};

			const { status, body } = await request(app)
				.patch(`/posts/${userPostId}`)
				.type("json")
				.send(mockData);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Update post successfully.");

			expect(body.data.title).toBe(mockData.title);
			expect(body.data.content).toBe(mockData.content);
			expect(body.data.mainImage).toBe(mockData.mainImage);
			expect(body.data.publish).toBe(mockData.publish);
		});
	});
	describe("DELETE/posts/:postId", () => {
		it(`should respond with a 404 status code and an error message, if a specified post is not found`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});
			app.use("/", blogRouter);

			const fakePostId = new Types.ObjectId();

			const { status, body } = await request(app).delete(
				`/posts/${fakePostId}`
			);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Post could not be found.");
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the post nor the blog admin`, async () => {
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

			const adminPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app).delete(
				`/posts/${adminPostId}`
			);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe(
				"This request requires higher permissions."
			);
		});
		it(`should respond with a 404 status code and an error message, if the provided post id is invalid`, async () => {
			const user = await User.findOne().exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: user._id };
				next();
			});

			app.use("/", blogRouter);

			const fakePostId = "123abc";

			const { status, body } = await request(app).delete(
				`/posts/${fakePostId}`
			);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe("Post could not be found.");
		});
		it("should successfully delete a specified post, if the authenticate user is a blog admin", async () => {
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

			await createComments({
				users: [user],
				posts: mockPosts,
				amount: 10,
			});

			const userPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app).delete(
				`/posts/${userPostId}`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Delete post successfully.");
		});
		it("should successfully delete a specified post, if the authenticate user is owner of the post", async () => {
			const users = await User.find({}).exec();

			app.use((req, res, next) => {
				req.isAuthenticated = () => true;
				req.user = { id: users[1]._id };
				next();
			});
			app.use("/", blogRouter);

			vi.spyOn(Post, "deleteOne");
			vi.spyOn(Comment, "deleteMany");

			const mockPosts = await createPosts({
				users: [users[1]],
				amount: 1,
			});

			await createComments({
				users: [users[1]],
				posts: mockPosts,
				amount: 10,
			});

			const userPostId = String(mockPosts[0]._id);

			const { status, body } = await request(app).delete(
				`/posts/${userPostId}`
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Delete post successfully.");

			expect(Comment.deleteMany)
				.toBeCalledWith({ post: userPostId })
				.toBeCalledTimes(1);
			expect(Post.deleteOne).toBeCalledTimes(1);
		});
	});
});
