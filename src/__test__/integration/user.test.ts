import { expect, describe, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { faker } from '@faker-js/faker';
import session from 'express-session';

import { userRouter } from '../../routes/user.js';

import { generateCSRFToken } from '../../utils/generateCSRFToken.js';

import { User } from '../../models/user.js';
import { Post } from '../../models/post.js';
import { Comment } from '../../models/comment.js';

import { createPosts } from '../../lib/seed.js';
import { passport } from '../../lib/passport.js';

import { UserDocument } from '../../models/user.js';
import { PostDocument } from '../../models/post.js';

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

app.use('/', userRouter);

describe('User paths', () => {
	describe('Authenticate', () => {
		it('should respond with a 401 status code and message if the user is not logged in', async () => {
			const { status, body } = await request(app).get(`/`);

			expect(status).toBe(401);
			expect(body).toStrictEqual({
				success: false,
				message: 'Missing authentication token.',
			});
		});
	});
	describe('GET /posts', () => {
		it(`should response with all posts of current login user`, async () => {
			const user = (await User.findOne().exec()) as UserDocument;

			const mockPosts = await createPosts({
				users: [user],
				amount: 3,
			});

			const agent = request.agent(app);

			await agent.post(`/login`).send({ email: user.email });

			const { status, body } = await agent.get(`/posts`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe("Get user's post list successfully.");

			expect(body.data.userPostsCount).toBe(mockPosts.length);

			const postsTitles = mockPosts.map(post => post.title);
			body.data.userPosts.forEach((post: PostDocument) => {
				expect(postsTitles).toContain(post.title);
			});
		});
	});
	describe('GET /posts/:postId', () => {
		it(`should response with with a 404 status, if a specified post of the user is not found`, async () => {
			const user = (await User.findOne().exec()) as UserDocument;

			await createPosts({
				users: [user],
				amount: 2,
			});

			const mockPost = {
				_id: 'test123',
			};

			const agent = request.agent(app);

			await agent.post(`/login`).send({ email: user.email });

			const { status, body } = await agent.get(`/posts/${mockPost._id}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe(`Post could not be found.`);
		});
		it(`should response with a specified post of the authenticate user`, async () => {
			const user = (await User.findOne({}).exec()) as UserDocument;

			const mockPosts = await createPosts({
				users: [user],
				amount: 2,
			});

			const mockPost = mockPosts[0];

			const agent = request.agent(app);

			await agent.post(`/login`).send({ email: user.email });

			const { status, body } = await agent.get(`/posts/${mockPost._id}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get post successfully.');

			expect(body.data._id).toBe(mockPost.id);
		});
	});
	describe('Verify CSRF token', () => {
		it('should respond with a 403 status code and message if a CSRF token is not provided', async () => {
			const user = (await User.findOne({}).exec()) as UserDocument;

			const agent = request.agent(app);

			await agent.post(`/login`).send({ email: user.email });

			const { status, body } = await agent.get(`/`);

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
		it('should respond with a 403 status code and message if a CSRF token send by client but mismatch', async () => {
			const user = (await User.findOne({}).exec()) as UserDocument;

			const agent = request.agent(app);

			await agent.post(`/login`).send({ email: user.email });

			const { status, body } = await agent
				.get(`/`)
				.set('x-csrf-token', '123.456');

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
	});
	describe('GET /', () => {
		it(`should response with the current login user detail`, async () => {
			const user = (await User.findOne().exec()) as UserDocument;

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.get(`/`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get user info successfully.');
			expect(body.data.username).toBe(user.username);
			expect(body.data.isAdmin).toBe(user.isAdmin);
		});
	});
	describe('PATCH /', () => {
		it(`should respond with a 400 status code and error fields message if a new username is not provided`, async () => {
			const user = (await User.findOne().exec()) as UserDocument;

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('username');
		});
		it(`should respond with a 409 status code and message if a new username exists`, async () => {
			const [user, secondUser] = await User.find({}).exec();

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/`)
				.type('json')
				.send({ username: secondUser.username })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(409);
			expect(body.success).toBe(false);
			expect(body.fields.username).toBe('Username is been used.');
		});
		it(`should update the user's username to a new username`, async () => {
			const user = (await User.findOne().exec()) as UserDocument;

			const mockNewUsername = faker.person.middleName();

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.patch(`/`)
				.type('json')
				.send({ username: mockNewUsername })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Update user successfully.');
			expect(body.data.username).toBe(mockNewUsername);
		});
	});
	describe('DELETE /', () => {
		it(`should delete the user and all posts and comments of that user, then log out.`, async () => {
			const user = (await User.findOne().exec()) as UserDocument;

			vi.spyOn(Post, 'deleteOne');
			vi.spyOn(User, 'findByIdAndDelete');
			const mockDeleteMany = vi.spyOn(Comment, 'deleteMany');
			const mockUpdateMany = vi.spyOn(Comment, 'updateMany');

			const mockPosts = await createPosts({
				users: [user],
				amount: 2,
			});
			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email });

			const [token, value] = loginResponse.body.token.split('.');

			const { status, body } = await agent
				.delete(`/`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete user successfully.');

			expect(mockDeleteMany.mock.calls).toStrictEqual(
				mockPosts.map(item => [{ post: item._id }]),
			);
			expect(Comment.deleteMany).toBeCalledTimes(mockPosts.length);
			expect(Post.deleteOne).toBeCalledTimes(mockPosts.length);
			expect(User.findByIdAndDelete).toBeCalledWith(`${user._id}`);
			expect(User.findByIdAndDelete).toBeCalledTimes(1);
			expect(mockUpdateMany.mock.calls[0][0]).toStrictEqual({
				author: `${user._id}`,
			});
			expect(Comment.updateMany).toBeCalledTimes(1);
		});
	});
});
