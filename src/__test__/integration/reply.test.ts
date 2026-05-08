import { expect, describe, it, beforeEach } from 'vitest';
import request from 'supertest';
import { Types, isValidObjectId } from 'mongoose';
import { hash } from 'argon2';
import createApp from '../../app';

import { User, UserDocument } from '../../models/user.js';
import { CommentDocument } from '../../models/comment.js';

import {
	createPosts,
	createComments,
	createCommentReplies,
	createReplies,
} from '../../seed/methods.js';

const app = createApp();

describe('Reply paths', () => {
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
	describe('GET /comments/:commentId/replies', () => {
		it('should respond with empty array, if the provided comment id is invalid', async () => {
			const fakeCommentId = 'abc123';

			const { status, body } = await request(app).get(
				`/blog/comments/${fakeCommentId}/replies`,
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
				`/blog/comments/${mockCommentId}/replies`,
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
	describe('POST /comments/:commentId/replies', () => {
		it('should respond with a 401 status code and message if the user is not logged in', async () => {
			const agent = request.agent(app);
			const { status, body } = await agent.post(
				`/blog/comments/test-id/replies`,
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
				.post(`/blog/comments/test-id/replies`)
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
				.send({ test: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided comment id is invalid`, async () => {
			const fakeCommentId = 'abc123';

			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/blog/comments/${fakeCommentId}/replies`)
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

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/blog/comments/${fakeCommentId}/replies`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Comment could not be found.');
		});
		it("should create a comment's reply and return new reply id to client", async () => {
			const agent = request.agent(app);

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
				users: [user],
				posts: mockPosts,
				amount: 1,
			});

			const commentId = mockComments[0].id;
			const mockContent = 'new content';

			const { status, body } = await agent
				.post(`/blog/comments/${commentId}/replies`)
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
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/blog/replies/test123`)
				.type('json')
				.send({ text: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided reply id is invalid`, async () => {
			const agent = request.agent(app);
			const fakeReplyId = 'abc123';

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/blog/replies/${fakeReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const agent = request.agent(app);
			const fakeReplyId = new Types.ObjectId();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/blog/replies/${fakeReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it('should create a reply that is a comment on that other reply.', async () => {
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

			const { status, body } = await agent
				.post(`/blog/replies/${secondUserReplyId}`)
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
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.patch(`/blog/replies/test123`)
				.type('json')
				.send({ text: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided reply id is invalid`, async () => {
			const agent = request.agent(app);
			const fakeReplyId = 'abc123';
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.patch(`/blog/replies/${fakeReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const agent = request.agent(app);
			const fakeReplyId = new Types.ObjectId();
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.patch(`/blog/replies/${fakeReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the reply nor the blog admin`, async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [admin],
				comments: mockComments,
				amount: 1,
			});

			const adminReplyId = mockCommentReplies[0].id;

			const { status, body } = await agent
				.patch(`/blog/replies/${adminReplyId}`)
				.type('json')
				.send({ content: 'new content' })
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('This request requires higher permissions.');
		});
		it("should successfully updated comment's reply and return to client, if the authenticate user is a blog admin", async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [user],
				comments: mockComments,
				amount: 1,
			});

			const userReplyId = String(mockCommentReplies[0]._id);

			const mockContent = 'This message is updated by admin not second user';

			const { status, body } = await agent
				.patch(`/blog/replies/${userReplyId}`)
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
			const agent = request.agent(app);
			const secondUser = await new User({
				username: 'example2',
				password: await hash(password),
				email: 'example2@gmail.com',
				isAdmin: true,
			}).save();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: secondUser.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

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

			const mockContent = 'This message is updated by owner';

			const { status, body } = await agent
				.patch(`/blog/replies/${secondUserReplyId}`)
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
			const agent = request.agent(app);
			const secondUser = await new User({
				username: 'example2',
				password: await hash(password),
				email: 'example2@gmail.com',
				isAdmin: true,
			}).save();

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: secondUser.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const mockPosts = await createPosts({
				users: [user],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [secondUser],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [user],
				comments: mockComments,
				amount: 1,
			});

			const mockReplies = await createReplies({
				users: [secondUser],
				commentReplies: mockCommentReplies,
				amount: 1,
			});

			const secondUserReplyId = mockReplies[0].id;

			const mockContent = 'This message is updated by owner';

			const { status, body } = await agent
				.patch(`/blog/replies/${secondUserReplyId}`)
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
			const agent = request.agent(app);
			const fakeReplyId = 'abc123';

			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.delete(`/blog/replies/${fakeReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified reply is not found`, async () => {
			const agent = request.agent(app);
			const fakeReplyId = new Types.ObjectId();
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.delete(`/blog/replies/${fakeReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Reply could not be found.');
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the reply nor the blog admin`, async () => {
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

			const mockCommentReplies = await createCommentReplies({
				users: [admin],
				comments: mockComments,
				amount: 1,
			});

			const adminReplyId = mockCommentReplies[0].id;

			const { status, body } = await agent
				.delete(`/blog/replies/${adminReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('This request requires higher permissions.');
		});
		it('should successfully delete reply and return to client, if the authenticate user is a blog admin', async () => {
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
				users: [admin],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [user],
				comments: mockComments,
				amount: 1,
			});

			const userReplyId = mockCommentReplies[0].id;

			const editor = admin.id;

			const { status, body } = await agent
				.delete(`/blog/replies/${userReplyId}`)
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

			const mockPosts = await createPosts({
				users: [user],
				amount: 1,
			});
			const mockComments = await createComments({
				users: [secondUser],
				posts: mockPosts,
				amount: 1,
			});

			const mockCommentReplies = await createCommentReplies({
				users: [user],
				comments: mockComments,
				amount: 1,
			});

			const secondUserReplyId = mockCommentReplies[0].id;

			const { status, body } = await agent
				.delete(`/blog/replies/${secondUserReplyId}`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete reply successfully.');

			expect(body.data.author.username).toBe(user.username);
			expect(body.data.post).toBe(String(mockPosts[0]._id));
			expect(body.data.parent).toBe(String(mockComments[0]._id));
			expect(body.data.content).toBe('Reply deleted by user');
			expect(body.data.deleted).toBe(true);
		});
	});
});
