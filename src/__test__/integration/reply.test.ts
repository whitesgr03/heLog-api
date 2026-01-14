import { expect, describe, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Types, isValidObjectId } from 'mongoose';
import session from 'express-session';

import { blogRouter } from '../../routes/blog.js';

import { generateCSRFToken } from '../../utils/generateCSRFToken.js';

import { User } from '../../models/user.js';

import { UserDocument } from '../../models/user.js';
import { CommentDocument } from '../../models/comment.js';

import {
	createPosts,
	createComments,
	createCommentReplies,
	createReplies,
} from '../../lib/seed.js';
import { passport } from '../../lib/passport.js';

const app = express();

app.use(
	session({
		secret: 'secret',
		resave: false,
		saveUninitialized: false,
		name: 'id',
	}),
);
app.use(passport.session());
app.use(express.json());

app.post('/login', (req, res, next) => {
	req.body = {
		...req.body,
		password: ' ',
	};
	passport.authenticate('local', (_err: any, user: Express.User) => {
		req.login(user, () =>
			res.send({
				token: generateCSRFToken(req.sessionID),
			}),
		);
	})(req, res, next);
});

app.use('/', blogRouter);

describe('Reply paths', () => {
	describe('GET /comments/:commentId/replies', () => {
		it('should respond with empty array, if the provided comment id is invalid', async () => {
			const fakeCommentId = 'abc123';

			const { status, body } = await request(app).get(
				`/comments/${fakeCommentId}/replies`,
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get all replies successfully.');
			expect(body.data).toHaveLength(0);
		});
		it("should return with a specified comment's replies", async () => {
			const users = await User.find().exec();

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
				`/comments/${mockCommentId}/replies`,
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get all replies successfully.');
			expect(body.data.length).toBe(mockCommentReplies.length);
			const repliesTitles = mockCommentReplies.map(reply => reply.content);
			body.data.forEach((reply: CommentDocument) => {
				expect(repliesTitles).toContain(reply.content);
			});
		});
	});
	describe('Authenticate', () => {
		it('should respond with a 401 status code and message if the user is not logged in', async () => {
			const { status, body } = await request(app).post(`/replies/testId`);
			expect(status).toBe(401);
			expect(body).toStrictEqual({
				success: false,
				message: 'Missing authentication token.',
			});
		});
	});
	describe('Verify CSRF token', () => {
		it('should respond with a 403 status code and message if a CSRF token is not provided', async () => {
			const user = (await User.findOne().exec()) as UserDocument;

			const agent = request.agent(app);

			await agent.post(`/login`).send({ email: user.email });

			const { status, body } = await agent.post(`/replies/testId`);

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
		it('should respond with a 403 status code and message if a CSRF token send by client but mismatch', async () => {
			const user = (await User.findOne().exec()) as UserDocument;

			const agent = request.agent(app);

			await agent.post(`/login`).send({ email: user.email });

			const { status, body } = await agent
				.post(`/replies/testId`)
				.set('x-csrf-token', '123.456');

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
	});
	describe('POST /comments/:commentId/replies', () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const agent = request.agent(app);
			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.post(`/comments/test-id/replies`)
				.send({ test: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided comment id is invalid`, async () => {
			const fakeCommentId = 'abc123';

			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.post(`/comments/${fakeCommentId}/replies`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Comment could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified comment is not found`, async () => {
			const fakeCommentId = new Types.ObjectId();

			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.post(`/comments/${fakeCommentId}/replies`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Comment could not be found.');
		});
		it("should create a comment's reply and return new reply id to client", async () => {
			const [user, secondUser] = await User.find({}).exec();

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
			const mockContent = 'new content';

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.post(`/comments/${secondUserCommentId}/replies`)
				.type('json')
				.send({ content: mockContent })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Create comment successfully.');
			expect(isValidObjectId(body.data._id)).toBeTruthy();
		});
	});
	describe('POST /replies/:replyId', () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.post(`/replies/test123`)
				.type('json')
				.send({ text: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided reply id is invalid`, async () => {
			const fakeReplyId = 'abc123';

			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.post(`/replies/${fakeReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const fakeReplyId = new Types.ObjectId();

			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.post(`/replies/${fakeReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it('should create a reply that is a comment on that other reply.', async () => {
			const [user, secondUser] = await User.find({}).exec();

			const mockPosts = await createPosts({
				users: [secondUser],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [secondUser],
				comments: mockComments,
				amount: 1,
			});

			const secondUserReplyId = String(mockCommentReplies[0]._id);

			const mockContent = 'new content';

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.post(`/replies/${secondUserReplyId}`)
				.type('json')
				.send({ content: mockContent })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Create reply successfully.');

			expect(body.data.author.username).toBe(user.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.reply._id).toBe(secondUserReplyId);
			expect(body.data.content).toBe(mockContent);
		});
	});
	describe('PATCH /replies/:replyId', () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/replies/test123`)
				.type('json')
				.send({ text: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided reply id is invalid`, async () => {
			const fakeReplyId = 'abc123';

			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/replies/${fakeReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const fakeReplyId = new Types.ObjectId();

			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/replies/${fakeReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the reply nor the blog admin`, async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [admin],
				comments: mockComments,
				amount: 1,
			});

			const adminReplyId = String(mockCommentReplies[0]._id);

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/replies/${adminReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('This request requires higher permissions.');
		});
		it("should successfully updated comment's reply and return to client, if the authenticate user is a blog admin", async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [user],
				comments: mockComments,
				amount: 1,
			});

			const userReplyId = String(mockCommentReplies[0]._id);

			const mockContent = 'This message is updated by admin not second user';

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });
			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/replies/${userReplyId}`)
				.type('json')
				.send({
					content: mockContent,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Update reply successfully.');

			expect(body.data.author.username).not.toBe(admin.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
		it("should successfully updated comment's reply and return to client, if the authenticate user is owner of the comment's reply", async () => {
			const [firstUser, secondUser] = await User.find({}).exec();

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

			const mockContent = 'This message is updated by owner';

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: secondUser.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/replies/${secondUserReplyId}`)
				.type('json')
				.send({
					content: mockContent,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Update reply successfully.');

			expect(body.data.author.username).toBe(secondUser.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
		it('should successfully updated reply and return to client, if the authenticate user is owner of the reply', async () => {
			const [firstUser, secondUser] = await User.find({}).exec();

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

			const mockContent = 'This message is updated by owner';

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: secondUser.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/replies/${secondUserReplyId}`)
				.type('json')
				.send({
					content: mockContent,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Update reply successfully.');

			expect(body.data.author.username).toBe(secondUser.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.reply._id).toBe(String(mockCommentReplies[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
	});
	describe('DELETE /replies/:replyId', () => {
		it(`should respond with a 404 status code and an error message, if the provided reply id is invalid`, async () => {
			const fakeReplyId = 'abc123';

			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });
			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.delete(`/replies/${fakeReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const fakeReplyId = new Types.ObjectId();

			const agent = request.agent(app);

			const user = (await User.findOne().exec()) as UserDocument;

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.delete(`/replies/${fakeReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the reply nor the blog admin`, async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [admin],
				comments: mockComments,
				amount: 1,
			});

			const adminReplyId = String(mockCommentReplies[0]._id);

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.delete(`/replies/${adminReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('This request requires higher permissions.');
		});
		it('should successfully delete reply and return to client, if the authenticate user is a blog admin', async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [user],
				comments: mockComments,
				amount: 1,
			});

			const userReplyId = String(mockCommentReplies[0]._id);

			const editor = String(admin._id);

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: admin.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.delete(`/replies/${userReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete reply successfully.');

			expect(body.data.author).not.toBe(editor);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe('Reply deleted by admin');
			expect(body.data.deleted).toBe(true);
		});
		it('should successfully delete reply and return to client, if the authenticate user is owner of the reply', async () => {
			const [firstUser, secondUser] = await User.find({}).exec();

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

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: secondUser.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.delete(`/replies/${secondUserReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete reply successfully.');

			expect(body.data.author.username).toBe(secondUser.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe('Reply deleted by user');
			expect(body.data.deleted).toBe(true);
		});
	});
});
