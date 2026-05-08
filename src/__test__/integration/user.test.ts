import { expect, describe, it, vi, beforeEach } from 'vitest';
import request from 'supertest';

import { hash } from 'argon2';
import createApp from '../../app';

import { User } from '../../models/user.js';
import { Post } from '../../models/post.js';
import { Comment } from '../../models/comment.js';
import { Federated } from '../../models/federated.js';

import { createPosts } from '../../seed/methods.js';

import { UserDocument } from '../../models/user.js';
import { PostDocument } from '../../models/post.js';

const app = createApp();

describe('User paths', () => {
	const password = '12345678';
	let user = {} as UserDocument;
	beforeEach(async () => {
		user = await new User({
			username: 'example',
			password: await hash(password),
			email: 'example@gmail.com',
			isAdmin: false,
		}).save();
	});
	describe('GET /posts', () => {
		it('should respond with a 401 status code and message if the user is not logged in', async () => {
			const { status, body } = await request(app).get(`/user/posts`);

			expect(status).toBe(401);
			expect(body).toStrictEqual({
				success: false,
				message: 'Missing authentication token.',
			});
		});
		it(`should response with all posts of current login user`, async () => {
			const agent = request.agent(app);
			await agent.post(`/account/login`).send({ email: user.email, password });

			const mockPosts = await createPosts({
				users: [user],
				amount: 3,
			});

			const { status, body } = await agent.get(`/user/posts`);

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
			const agent = request.agent(app);
			await agent.post(`/account/login`).send({ email: user.email, password });

			await createPosts({
				users: [user],
				amount: 2,
			});

			const mockPost = {
				_id: 'test123',
			};

			const { status, body } = await agent.get(`/user/posts/${mockPost._id}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe(`Post could not be found.`);
		});
		it(`should response with a specified post of the authenticate user`, async () => {
			const agent = request.agent(app);
			await agent.post(`/account/login`).send({ email: user.email, password });

			const mockPosts = await createPosts({
				users: [user],
				amount: 2,
			});

			const mockPost = mockPosts[0];

			const { status, body } = await agent.get(`/user/posts/${mockPost._id}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get post successfully.');
			expect(body.data._id).toBe(mockPost.id);
		});
	});
	describe('GET /', () => {
		it('should respond with a 403 status code and message if a CSRF token send by client but mismatch', async () => {
			const agent = request.agent(app);
			await agent
				.post(`/account/login`)
				.send({ email: user.email, password: password });
			const { status, body } = await agent
				.post(`/user/posts`)
				.set('x-csrf-token', '123.456');
			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
		it(`should response with the current login user detail`, async () => {
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.get(`/user`)
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
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.patch(`/user`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('username');
		});
		it(`should respond with a 409 status code and message if a new username exists`, async () => {
			const agent = request.agent(app);
			const secondUser = await new User({
				username: 'example2',
				password: await hash(password),
				email: 'example2@gmail.com',
				isAdmin: true,
			}).save();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.patch(`/user`)
				.type('json')
				.send({ username: secondUser.username })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(409);
			expect(body.success).toBe(false);
			expect(body.fields.username).toBe('Username is been used.');
		});
		it(`should update the user's username to a new username`, async () => {
			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const mockNewUsername = 'example';

			const { status, body } = await agent
				.patch(`/user`)
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
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			vi.spyOn(Post, 'deleteOne');
			vi.spyOn(Federated, 'deleteOne');
			vi.spyOn(User, 'findByIdAndDelete');
			vi.spyOn(Comment, 'deleteMany');
			vi.spyOn(Comment, 'updateMany');

			const mockPosts = await createPosts({
				users: [user],
				amount: 2,
			});

			const { status, body, headers } = await agent
				.delete(`/user`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete user successfully.');
			expect(headers['set-cookie']).toStrictEqual([
				'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
				'id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
			]);

			expect(Comment.deleteMany).toBeCalledTimes(mockPosts.length);
			expect(Post.deleteOne).toBeCalledTimes(mockPosts.length);
			expect(Federated.deleteOne).toBeCalledTimes(1);
			expect(User.findByIdAndDelete).toBeCalledTimes(1);
			expect(Comment.updateMany).toBeCalledTimes(1);
		});
	});
});
