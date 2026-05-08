import { expect, describe, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { faker } from '@faker-js/faker';
import { hash } from 'argon2';
import createApp from '../../app';

import { User, UserDocument } from '../../models/user.js';
import { Comment } from '../../models/comment.js';
import { Post } from '../../models/post.js';

import { createPosts, createComments } from '../../seed/methods.js';

const app = createApp();

describe('Post paths', async () => {
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
	describe('GET /posts', async () => {
		it('should respond with empty array, if there are not posts', async () => {
			const { status, body } = await request(app).get(`/blog/posts`);
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get all posts successfully.');
			expect(body.data.posts.length).toBe(0);
			expect(body.data.postsCount).toBe(0);
		});
		it('should return all posts', async () => {
			const users = await User.find({}).exec();
			const amount = 5;
			const mockPosts = await createPosts({
				users,
				amount,
			});
			const { status, body } = await request(app).get(`/blog/posts`);
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get all posts successfully.');
			expect(body.data.posts.length).toBe(mockPosts.length);
			expect(body.data.postsCount).toBe(amount);
		});
	});
	describe('GET /posts/:postId', () => {
		it(`should respond with a 404 status code and an error message, if the provided post id is invalid`, async () => {
			const fakePostId = 'abc123';
			const { status, body } = await request(app).get(
				`/blog/posts/${fakePostId}`,
			);
			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Post could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified post is not found`, async () => {
			const fakePostId = new Types.ObjectId();
			const { status, body } = await request(app).get(
				`/blog/posts/${fakePostId}`,
			);
			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Post could not be found.');
		});
		it('should return a specified post detail', async () => {
			const mockPosts = await createPosts({
				users: [user],
				amount: 1,
			});
			const userPostId = mockPosts[0].id;
			const { status, body } = await request(app).get(
				`/blog/posts/${userPostId}`,
			);
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Get post successfully.');
			expect(body.data._id).toBe(userPostId);
		});
	});
	describe('POST /posts', async () => {
		it('should respond with a 401 status code and message if the user is not logged in', async () => {
			const { status, body } = await request(app).post(`/blog/posts`);
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
				.post(`/blog/posts`)
				.set('x-csrf-token', '123.456');
			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
		it(`should respond with a 400 status code and an error field message, if the length of title value is greater then 100`, async () => {
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });
			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			const { status, body } = await agent
				.post(`/blog/posts`)
				.set('x-csrf-token', `${token}.${value}`)
				.send({ title: faker.string.nanoid(105) });
			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('title');
		});
		it(`should respond with a 400 status code and an error field message, if the length of content value is greater then 8000`, async () => {
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });
			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			const { status, body } = await agent
				.post(`/blog/posts`)
				.send({ content: `<p>${faker.string.nanoid(8005)}</p>` })
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it('should create a post and return to client', async () => {
			const mockData = {
				title: 'new title',
				mainImage: faker.image.url(),
				content: 'new content',
			};
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });
			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			const { status, body } = await agent
				.post(`/blog/posts`)
				.type('json')
				.send(mockData)
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Create post successfully.');
			expect(body.data.title).toBe(mockData.title);
			expect(body.data.mainImage).toBe(mockData.mainImage);
			expect(body.data.content).toBe(mockData.content);
		});
	});
	describe('PATCH /posts/:postId', async () => {
		it(`should respond with a 400 status code and the error field message, if the value of publish is not provided`, async () => {
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
			const userPostId = mockPosts[0].id;
			const { status, body } = await agent
				.patch(`/blog/posts/${userPostId}`)
				.type('json')
				.send({
					title: 'new title',
					content: 'new content',
					mainImage: 'new image resource url',
				})
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('publish');
		});
		it(`should respond with a 400 status code and the message for each error fields, if all required fields are not provided when the value of publish is true`, async () => {
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
			const userPostId = mockPosts[0].id;
			const { status, body } = await agent
				.patch(`/blog/posts/${userPostId}`)
				.type('json')
				.send({ publish: true })
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('title');
			expect(body.fields).toHaveProperty('mainImage');
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 400 status code and an error field message, if the length of content value is greater then 8000`, async () => {
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
			const userPostId = mockPosts[0].id;
			const { status, body } = await agent
				.patch(`/blog/posts/${userPostId}`)
				.send({
					content: `<p>${faker.string.nanoid(8005)}</p>`,
					publish: true,
				})
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('content');
		});
		it(`should respond with a 404 status code and an error message, if the provided post id is invalid`, async () => {
			const agent = request.agent(app);
			const fakePostId = '123abc';
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });
			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			const { status, body } = await agent
				.patch(`/blog/posts/${fakePostId}`)
				.type('json')
				.send({
					title: 'new title',
					content: 'new content',
					mainImage: faker.image.urlPicsumPhotos({
						width: 10,
						height: 10,
					}),
					publish: true,
				})
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Post could not be found.');
		});
		it(`should respond with a 404 status code and an error message, if a specified post is not found`, async () => {
			const agent = request.agent(app);
			const fakePostId = new Types.ObjectId();
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });
			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			const { status, body } = await agent
				.patch(`/blog/posts/${fakePostId}`)
				.type('json')
				.send({
					title: 'new title',
					content: 'new content',
					mainImage: faker.image.urlPicsumPhotos({
						width: 10,
						height: 10,
					}),
					publish: true,
				})
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Post could not be found.');
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the post nor the blog admin`, async () => {
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
			const secondUserPostId = mockPosts[0].id;
			const { status, body } = await agent
				.patch(`/blog/posts/${secondUserPostId}`)
				.type('json')
				.send({
					title: 'new title',
					content: 'new content',
					mainImage: faker.image.urlPicsumPhotos({
						width: 10,
						height: 10,
					}),
					publish: true,
				})
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('This request requires higher permissions.');
		});
		it('should successfully updated a specified post and return to client, if the authenticate user is a blog admin', async () => {
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
			const userPostId = mockPosts[0].id;
			const mockData = {
				title: 'new title',
				content: 'new content',
				mainImage: 'new image resource url',
				publish: false,
			};
			const { status, body } = await agent
				.patch(`/blog/posts/${userPostId}`)
				.type('json')
				.send(mockData)
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Update post successfully.');
			expect(body.data.title).toBe(mockData.title);
			expect(body.data.content).toBe(mockData.content);
			expect(body.data.mainImage).toBe(mockData.mainImage);
			expect(body.data.publish).toBe(mockData.publish);
		});
		it('should successfully updated a specified post and return to client, if the authenticate user is owner of the post', async () => {
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
			const userPostId = mockPosts[0].id;
			const mockData = {
				title: 'new title',
				content: 'new content',
				mainImage: 'new image resource url',
				publish: false,
			};

			const { status, body } = await agent
				.patch(`/blog/posts/${userPostId}`)
				.type('json')
				.send(mockData)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Update post successfully.');
			expect(body.data.title).toBe(mockData.title);
			expect(body.data.content).toBe(mockData.content);
			expect(body.data.mainImage).toBe(mockData.mainImage);
			expect(body.data.publish).toBe(mockData.publish);
		});
	});
	describe('DELETE/posts/:postId', () => {
		it(`should respond with a 404 status code and an error message, if a specified post is not found`, async () => {
			const agent = request.agent(app);
			const fakePostId = new Types.ObjectId();
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });
			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			const { status, body } = await agent
				.delete(`/blog/posts/${fakePostId}`)
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Post could not be found.');
		});
		it(`should respond with a 403 status code and an error message, if the authenticate user is nether the owner of the post nor the blog admin`, async () => {
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
			const postId = String(mockPosts[0]._id);
			const { status, body } = await agent
				.delete(`/blog/posts/${postId}`)
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('This request requires higher permissions.');
		});
		it(`should respond with a 404 status code and an error message, if the provided post id is invalid`, async () => {
			const agent = request.agent(app);
			const fakePostId = '123abc';
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });
			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			const { status, body } = await agent
				.delete(`/blog/posts/${fakePostId}`)
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Post could not be found.');
		});
		it('should successfully delete a specified post, if the authenticate user is a blog admin', async () => {
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
			await createComments({
				users: [user],
				posts: mockPosts,
				amount: 10,
			});
			const userPostId = mockPosts[0].id;
			const { status, body } = await agent
				.delete(`/blog/posts/${userPostId}`)
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete post successfully.');
		});
		it('should successfully delete a specified post, if the authenticate user is owner of the post', async () => {
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
			vi.spyOn(Post, 'deleteOne');
			vi.spyOn(Comment, 'deleteMany');
			const mockPosts = await createPosts({
				users: [secondUser],
				amount: 1,
			});
			await createComments({
				users: [secondUser],
				posts: mockPosts,
				amount: 10,
			});
			const userPostId = mockPosts[0].id;
			const { status, body } = await agent
				.delete(`/blog/posts/${userPostId}`)
				.set('x-csrf-token', `${token}.${value}`);
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('Delete post successfully.');
			expect(Comment.deleteMany).toBeCalledWith({ post: userPostId });
			expect(Comment.deleteMany).toBeCalledTimes(1);
			expect(Post.deleteOne).toBeCalledTimes(1);
		});
	});
});
