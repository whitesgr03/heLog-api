import { expect, describe, it, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { hash } from 'argon2';

import createApp from '../../app';

import { User } from '../../models/user.js';

import { UserDocument } from '../../models/user.js';
import { CommentDocument } from '../../models/comment.js';

import { createPosts, createComments } from '../../seed/methods.js';

const app = createApp();
describe('Comment paths', () => {
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

	describe('GET /posts/:postId/comments', () => {
		it('should respond with empty array, if the provided comment id is invalid', async () => {
			const fakePostId = 'abc123';

			const { status, body } = await request(app).get(
				`/blog/posts/${fakePostId}/comments`,
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get all comments successfully.');
			expect(body.data).toHaveLength(0);
		});
		it('should return all comments for the specified post', async () => {
			const users = await User.find().exec();

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
				`/blog/posts/${mockPostId}/comments`,
			);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get all comments successfully.');
			expect(body.data.commentsCount).toBe(mockComments.length);

			const commentsTitles = mockComments.map(comment => comment.content);
			body.data.comments.forEach((comment: CommentDocument) => {
				expect(commentsTitles).toContain(comment.content);
			});
		});
	});
	describe('POST /posts/:postId/comments', () => {
		it('should respond with a 401 status code and message if the user is not logged in', async () => {
			const { status, body } = await request(app).post(
				`/blog/posts/testId/comments`,
			);
			expect(status).toBe(401);
			expect(body).toStrictEqual({
				success: false,
				message: 'Missing authentication token.',
			});
		});
		it('should respond with a 403 status code and message if a CSRF token send by client but mismatch', async () => {
			const agent = request.agent(app);
			await agent
				.post(`/account/login`)
				.send({ email: user.email, password: password });

			const { status, body } = await agent
				.post(`/blog/posts/testid/comments`)
				.set('x-csrf-token', '123.456');

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/blog/comments/test-id/replies`)
				.send({ text: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided post id is invalid`, async () => {
			const fakePostId = 'abc123';

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			const { status, body } = await agent
				.post(`/blog/posts/${fakePostId}/comments`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Post could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified post is not found`, async () => {
			const fakePostId = new Types.ObjectId();

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/blog/posts/${fakePostId}/comments`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Post could not be found.');
		});
		it('should create a comment', async () => {
			const secondUser = await new User({
				username: 'example2',
				password: await hash(password),
				email: 'example2@gmail.com',
				isAdmin: true,
			}).save();

			const mockPosts = await createPosts({
				users: [secondUser],
				amount: 1,
			});

			const secondUserPostId = mockPosts[0].id;
			const mockContent = 'new content';

			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/blog/posts/${secondUserPostId}/comments`)
				.type('json')
				.send({ content: mockContent })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Create comment successfully.');
		});
	});
	describe('PATCH /comments/:commentId', () => {
		it(`should respond with a 400 status code and an error field message, if a value of content field is not provided`, async () => {
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.patch(`/blog/comments/test123`)
				.type('json')
				.send({ text: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided comment id is invalid`, async () => {
			const agent = request.agent(app);
			const fakeCommentId = 'abc123';

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.patch(`/blog/comments/${fakeCommentId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Comment could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified comment is not found`, async () => {
			const agent = request.agent(app);
			const fakeCommentId = new Types.ObjectId();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.patch(`/blog/comments/${fakeCommentId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Comment could not be found.');
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the comment nor the blog admin`, async () => {
			const agent = request.agent(app);
			const admin = await new User({
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

			const mockPosts = await createPosts({
				users: [admin],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [admin],
				posts: mockPosts,
				amount: 1,
			});

			const adminCommentId = mockComments[0].id;

			const { status, body } = await agent
				.patch(`/blog/comments/${adminCommentId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('This request requires higher permissions.');
		});
		it('should successfully updated a specified comment and return to client, if the authenticate user is a blog admin', async () => {
			const agent = request.agent(app);
			const admin = await new User({
				username: 'example2',
				password: await hash(password),
				email: 'example2@gmail.com',
				isAdmin: true,
			}).save();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: admin.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

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

			const mockContent = 'This message is updated by admin not user';

			const { status, body } = await agent
				.patch(`/blog/comments/${userCommentId}`)
				.type('json')
				.send({
					content: mockContent,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Update comment successfully.');

			expect(body.data.author.username).not.toBe(admin.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
		it('should successfully updated a specified comment and return to client, if the authenticate user is owner of the comment', async () => {
			const agent = request.agent(app);
			const admin = await new User({
				username: 'example2',
				password: await hash(password),
				email: 'example2@gmail.com',
				isAdmin: true,
			}).save();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: admin.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const mockPosts = await createPosts({
				users: [admin],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const userCommentId = mockComments[0].id;

			const mockContent = 'This message is updated by owner';

			const { status, body } = await agent
				.patch(`/blog/comments/${userCommentId}`)
				.type('json')
				.send({
					content: mockContent,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Update comment successfully.');

			expect(body.data.author.username).toBe(user.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe(mockContent);
		});
	});
	describe('DELETE/comments/:commentId', () => {
		it(`should respond with a 404 status code and an error message, if the provided comment id is invalid`, async () => {
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const fakeCommentId = 'abc123';

			const { status, body } = await agent
				.delete(`/blog/comments/${fakeCommentId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Comment could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const agent = request.agent(app);
			const fakeCommentId = new Types.ObjectId();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.delete(`/blog/comments/${fakeCommentId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Comment could not be found.');
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the comment nor the blog admin`, async () => {
			const agent = request.agent(app);
			const admin = await new User({
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

			const mockPosts = await createPosts({
				users: [user],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [admin],
				posts: mockPosts,
				amount: 1,
			});

			const adminCommentId = mockComments[0]._id;

			const { status, body } = await agent
				.delete(`/blog/comments/${adminCommentId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('This request requires higher permissions.');
		});
		it('should successfully delete a specified comment and return to client, if the authenticate user is a blog admin', async () => {
			const agent = request.agent(app);
			const admin = await new User({
				username: 'example2',
				password: await hash(password),
				email: 'example2@gmail.com',
				isAdmin: true,
			}).save();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: admin.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const mockPosts = await createPosts({
				users: [admin],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const userCommentId = mockComments[0].id;

			const editor = admin.id;

			const { status, body } = await agent
				.delete(`/blog/comments/${userCommentId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete comment successfully.');

			expect(body.data.author).not.toBe(editor);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe('Comment deleted by admin');
			expect(body.data.deleted).toBe(true);
		});
		it('should successfully delete a specified comment and return to client, if the authenticate user is owner of the comment', async () => {
			const agent = request.agent(app);
			const admin = await new User({
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

			const mockPosts = await createPosts({
				users: [admin],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const userCommentId = mockComments[0].id;

			const { status, body } = await agent
				.delete(`/blog/comments/${userCommentId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete comment successfully.');

			expect(body.data.author.username).toBe(user.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.content).toBe('Comment deleted by user');
			expect(body.data.deleted).toBe(true);
		});
	});
});
