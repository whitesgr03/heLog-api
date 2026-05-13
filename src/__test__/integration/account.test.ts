import { expect, describe, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import mongoose from 'mongoose';
import passport from 'passport';
import argon2 from 'argon2';
import mjml2html from 'mjml';
import createApp from '../../app';
import { mailgun } from '../../utils/mailgun.js';

import { User } from '../../models/user.js';
import { Token } from '../../models/token.js';
import { Code } from '../../models/code.js';
import { UserDocument } from '../../models/user.js';

import {
	limiterLoginFailsByEmail,
	limiterRequestRegistrationByIp,
	limiterRequestResettingPasswordByEmail,
	limiterVerifyCodeByEmail,
} from '../../utils/rateLimiter.js';

vi.mock('mjml', { spy: true });
vi.mock('../../utils/mailgun.js');

const app = createApp();

describe('Account paths', async () => {
	const code = '123456';
	const password = '12345678';
	let user = {} as UserDocument;

	beforeEach(async () => {
		user = await new User({
			username: 'example',
			password: await argon2.hash(password),
			email: 'example@gmail.com',
			isAdmin: false,
		}).save();
	});

	describe('GET /oauth2/redirect/:federation', () => {
		const agent = request.agent(app);
		it('should redirect to sign in page if the query code is not found', async () => {
			const { status, headers } = await agent.get(
				`/account/oauth2/redirect/google`,
			);

			expect(status).toBe(302);
			expect(headers['location']).toBe(`${process.env.HELOG_ACCOUNT}/sign-in`);
		});
		it('should respond with a 500 status code if an unknown error occurs', async () => {
			const mockCode = '123';
			const mockAuthenticateFn = vi.fn();

			vi.spyOn(passport, 'authenticate').mockImplementation((_, cb: any) =>
				mockAuthenticateFn.mockImplementationOnce((_req, _res, _next) =>
					cb('error'),
				),
			);

			const { status, body } = await agent.get(
				`/account/oauth2/redirect/facebook?code=${mockCode}`,
			);

			expect(status).toBe(500);
			expect(body.success).toBe(false);
		});
		it('should respond a session and login user', async () => {
			const mockAuthenticateFn = vi.fn();

			vi.spyOn(passport, 'authenticate').mockImplementation((_, cb: any) =>
				mockAuthenticateFn.mockImplementationOnce((_req, _res, _next) =>
					cb(null, true),
				),
			);

			const { status, headers } = await agent.get(
				`/account/oauth2/redirect/google?code=${code}`,
			);

			expect(status).toBe(302);
			expect(headers).toHaveProperty('cache-control');
			expect(headers['set-cookie'][0]).toMatch(/token=/);
			expect(headers['set-cookie'][1]).toMatch(/id=/);
			expect(headers['location']).toBe(process.env.HELOG_URL);
			expect(passport.authenticate).toHaveBeenCalledTimes(1);
			expect(mockAuthenticateFn).toHaveBeenCalledTimes(1);
		});
	});
	describe('POST /logout', () => {
		beforeEach(() => {
			limiterRequestResettingPasswordByEmail.consume = vi
				.fn()
				.mockResolvedValueOnce('');
		});
		it('should respond with a 401 status code and message if the user is not logged in', async () => {
			const { status, body } = await request(app).post(`/account/logout`);

			expect(status).toBe(401);
			expect(body).toStrictEqual({
				success: false,
				message: 'Missing authentication token.',
			});
		});
		it('should respond with a 403 status code and message if a CSRF token is incorrect', async () => {
			const agent = request.agent(app);
			await agent.post(`/account/login`).send({ email: user.email, password });

			const { status, body } = await agent.post(`/account/logout`);

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
		it(`should logout user`, async () => {
			const agent = request.agent(app);
			const loginResponse = await agent
				.post(`/account/login`)
				.send({ email: user.email, password });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body, headers } = await agent
				.post(`/account/logout`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body).toStrictEqual({
				success: true,
				message: 'User logout successfully.',
			});
			expect(headers['set-cookie']).toStrictEqual([
				'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
				'id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
			]);
		});
	});
	describe('POST /login', () => {
		it('should respond with a 302 status code and redirect to home page if the user is logged in', async () => {
			const agent = request.agent(app);
			await agent.post(`/account/login`).send({ email: user.email, password });

			const { status, headers } = await agent.post(`/account/login`);

			expect(status).toBe(302);
			expect(headers['location']).toBe(process.env.HELOG_URL);
		});
		it('should respond with a 400 status code and message if the email or password is not provided', async () => {
			const { status, body } = await request(app).post(`/account/login`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
			expect(body.fields).toHaveProperty('password');
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterLoginFailsByEmail.consume = vi
				.fn()
				.mockRejectedValueOnce(new RateLimiterRes());

			const { status, body, headers } = await request(app)
				.post(`/account/login`)
				.send({
					email: user.email,
					password,
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 500 status code if an unknown error occurs', async () => {
			limiterLoginFailsByEmail.consume = vi
				.fn()
				.mockRejectedValueOnce(new Error());

			const { status, body } = await request(app).post(`/account/login`).send({
				email: user.email,
				password,
			});

			expect(status).toBe(500);
			expect(body.success).toBe(false);
		});
		it('should respond with a 401 status code and message if the email or password is invalid', async () => {
			vi.spyOn(passport, 'authenticate');

			limiterLoginFailsByEmail.consume = vi.fn().mockResolvedValueOnce('');

			const { status, body } = await request(app).post(`/account/login`).send({
				email: 'example@abc.com',
				password,
			});
			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(passport.authenticate).toHaveBeenCalledTimes(1);
		});
		it('should respond a session and login user', async () => {
			vi.spyOn(argon2, 'verify');

			limiterLoginFailsByEmail.consume = vi.fn().mockResolvedValueOnce('');

			const { status, body, headers } = await request(app)
				.post(`/account/login`)
				.send({
					email: user.email,
					password,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(headers).toHaveProperty('cache-control');
			expect(headers['set-cookie'][0]).toMatch(/token=/);
			expect(headers['set-cookie'][1]).toMatch(/id=/);
			expect(argon2.verify).toHaveBeenCalledTimes(1);
		});
	});
	describe('POST /requestRegister', () => {
		it('should respond with a 400 status code and message if the input data is incorrect', async () => {
			const { status, body } = await request(app)
				.post(`/account/requestRegister`)
				.send({
					password: '1',
				});

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('username');
			expect(body.fields).toHaveProperty('email');
			expect(body.fields).toHaveProperty('password');
			expect(body.fields).toHaveProperty('confirmPassword');
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterRequestRegistrationByIp.consume = vi
				.fn()
				.mockRejectedValueOnce(new RateLimiterRes());

			const { status, body, headers } = await request(app)
				.post(`/account/requestRegister`)
				.send({
					username: 'test',
					email: user.email,
					password,
					confirmPassword: password,
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 500 status code if an unknown error occurs', async () => {
			limiterRequestRegistrationByIp.consume = vi
				.fn()
				.mockRejectedValueOnce(new Error());

			const { status, body } = await request(app)
				.post(`/account/requestRegister`)
				.send({
					username: 'test',
					email: user.email,
					password,
					confirmPassword: password,
				});

			expect(status).toBe(500);
			expect(body.success).toBe(false);
		});
		it('should send email and respond a success message if the email is exist', async () => {
			vi.mocked(mailgun.messages.create).mockResolvedValueOnce('' as any);
			limiterLoginFailsByEmail.consume = vi.fn().mockResolvedValueOnce('');

			const { status, body } = await request(app)
				.post(`/account/requestRegister`)
				.send({
					username: 'example2',
					email: user.email,
					password,
					confirmPassword: password,
				});
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mailgun.messages.create).toHaveBeenCalledTimes(1);
			expect(mjml2html).toHaveBeenCalledTimes(1);
		});
		it('should send email and create a new user and token and respond a success message if the email is not found', async () => {
			vi.mocked(mailgun.messages.create).mockResolvedValueOnce('' as any);
			vi.spyOn(argon2, 'hash');
			limiterLoginFailsByEmail.consume = vi.fn().mockResolvedValueOnce('');

			const { status, body } = await request(app)
				.post(`/account/requestRegister`)
				.send({
					username: 'example2',
					email: 'example2@gmail.com',
					password,
					confirmPassword: password,
				});

			const newUser = await User.findOne({ username: 'example2' }).exec();
			const newToken = await Token.findOne({ user: newUser?.id }).exec();

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.message).toBe('The verification token is sending');
			expect(mailgun.messages.create).toHaveBeenCalledTimes(1);
			expect(newUser).not.toBeNull();
			expect(newToken).not.toBeNull();
			expect(argon2.hash).toHaveBeenCalledTimes(2);
		});
	});
	describe('POST /register', () => {
		it('should respond with a 428 status code and message if the request registration limiter is not consumed', async () => {
			limiterRequestRegistrationByIp.get = vi.fn().mockResolvedValueOnce(null);

			const { status, body } = await request(app).post(`/account/register`);
			expect(status).toBe(428);
			expect(body.success).toBe(false);
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterRequestRegistrationByIp.get = vi
				.fn()
				.mockResolvedValueOnce(new RateLimiterRes());

			const { status, body, headers } =
				await request(app).post(`/account/register`);
			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 401 status code and message if token is not provided', async () => {
			limiterRequestRegistrationByIp.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			const { status, body } = await request(app)
				.post(`/account/register`)
				.send({
					tokenId: '123',
				});
			expect(status).toBe(401);
			expect(body.success).toBe(false);
		});
		it('should respond with a 401 status code and message if token is not found', async () => {
			limiterRequestRegistrationByIp.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			const { status, body } = await request(app)
				.post(`/account/register`)
				.send({
					tokenId: new mongoose.Types.ObjectId(),
				});
			expect(status).toBe(401);
			expect(body.success).toBe(false);
		});
		it('should respond with a 401 status code and message if token is invalid', async () => {
			const token = 'token';
			limiterRequestRegistrationByIp.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			vi.spyOn(argon2, 'verify');

			const newToken = new Token({
				user: user.id,
				token: await argon2.hash('fakeToken'),
				email: user.email,
			});

			await newToken.save();

			const { status, body } = await request(app)
				.post(`/account/register`)
				.send({
					tokenId: newToken.id,
					token,
				});
			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(argon2.verify).toHaveBeenCalledTimes(1);
		});
		it('should response success and create a new account', async () => {
			const token = 'token';
			limiterRequestRegistrationByIp.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			const newToken = new Token({
				user: user.id,
				token: await argon2.hash(token),
				email: user.email,
			});

			await newToken.save();

			const { status, body } = await request(app)
				.post(`/account/register`)
				.send({
					tokenId: newToken.id,
					token,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(
				await User.findOne({ email: newToken.email }).exec(),
			).not.toBeNull();
		});
	});
	describe('POST /requestVerificationCode', () => {
		it('should respond with a 400 status code and message if the input data is incorrect', async () => {
			const { status, body } = await request(app).post(
				`/account/requestVerificationCode`,
			);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
		});
		it('should respond with a 428 status code and message if the request reset password limiter is not consumed', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(null);

			const { status, body } = await request(app)
				.post(`/account/requestVerificationCode`)
				.send({
					email: user.email,
				});

			expect(status).toBe(428);
			expect(body.success).toBe(false);
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(true);
			limiterRequestResettingPasswordByEmail.consume = vi
				.fn()
				.mockRejectedValueOnce(new RateLimiterRes());

			const { status, body, headers } = await request(app)
				.post(`/account/requestVerificationCode`)
				.send({
					email: user.email,
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 401 status code and message if the code is not found', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(true);
			limiterRequestResettingPasswordByEmail.consume = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			vi.spyOn(argon2, 'hash');

			const { status, body } = await request(app)
				.post(`/account/requestVerificationCode`)
				.send({
					email: user.email,
				});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(argon2.hash).toHaveBeenCalledTimes(1);
		});
		it('should send email and create a code and respond a success message if the email is exist', async () => {
			vi.mocked(mailgun.messages.create).mockResolvedValueOnce('' as any);
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(true);
			limiterRequestResettingPasswordByEmail.consume = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			const verificationCode = new Code({
				code,
				email: user.email,
			});

			await verificationCode.save();

			const { status, body } = await request(app)
				.post(`/account/requestVerificationCode`)
				.send({
					email: user.email,
				});

			const newCode = await Code.findOne({ email: user.email }).exec();

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mjml2html).toHaveBeenCalledTimes(1);
			expect(mailgun.messages.create).toHaveBeenCalledTimes(1);
			expect(newCode?.code).not.toBe(verificationCode.code);
		});
	});
	describe('POST /verifyCode', () => {
		it('should respond with a 400 status code and message if the input data is incorrect', async () => {
			const { status, body } = await request(app).post(`/account/verifyCode`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
			expect(body.fields).toHaveProperty('code');
		});
		it('should respond with a 428 status code and message if the request reset password limiter is not consumed', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(null);

			const { status, body } = await request(app)
				.post(`/account/verifyCode`)
				.send({
					email: user.email,
					code,
				});

			expect(status).toBe(428);
			expect(body.success).toBe(false);
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(new RateLimiterRes());

			const { status, body, headers } = await request(app)
				.post(`/account/verifyCode`)
				.send({
					email: user.email,
					code,
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 401 status code and message if the server is blocked by the rate limiter', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			limiterVerifyCodeByEmail.consume = vi
				.fn()
				.mockRejectedValueOnce(new RateLimiterRes());

			const { status, body } = await request(app)
				.post(`/account/verifyCode`)
				.send({
					email: user.email,
					code,
				});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
		});
		it('should respond with a 401 status code and message if the code is not found', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			limiterVerifyCodeByEmail.consume = vi.fn().mockResolvedValueOnce('');

			const { status, body } = await request(app)
				.post(`/account/verifyCode`)
				.send({
					email: user.email,
					code,
				});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Code is invalid.');
		});
		it('should respond with a 401 status code and message if the code is invalid', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			limiterVerifyCodeByEmail.consume = vi.fn().mockResolvedValueOnce('');

			vi.spyOn(argon2, 'verify');

			const newCode = new Code({
				code: await argon2.hash('mockCode'),
				email: user.email,
			});

			await newCode.save();

			const { status, body } = await request(app)
				.post(`/account/verifyCode`)
				.send({
					email: user.email,
					code,
				});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Code is invalid.');
			expect(argon2.verify).toHaveBeenCalledTimes(1);
		});
		it('should respond a session and success message', async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			limiterVerifyCodeByEmail.consume = vi.fn().mockResolvedValueOnce('');

			const newCode = new Code({
				code: await argon2.hash(code),
				email: user.email,
			});

			await newCode.save();

			const { status, body, headers } = await request(app)
				.post(`/account/verifyCode`)
				.send({
					email: user.email,
					code,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(headers).toHaveProperty('expire-after');
			expect(headers).toHaveProperty('cache-control');
			expect(headers['set-cookie'][0]).toMatch(/token=/);
			expect(headers['set-cookie'][1]).toMatch(/id=/);
		});
	});
	describe('POST /requestResetPassword', () => {
		it('should respond with a 400 status code and message if the email is not provided', async () => {
			const { status, body } = await request(app).post(
				`/account/requestResetPassword`,
			);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterRequestResettingPasswordByEmail.consume = vi
				.fn()
				.mockRejectedValueOnce(new RateLimiterRes());

			const { status, body, headers } = await request(app)
				.post(`/account/requestResetPassword`)
				.send({
					email: user.email,
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should send email and respond a success message if the email is not found', async () => {
			vi.mocked(mailgun.messages.create).mockResolvedValueOnce('' as any);
			limiterRequestResettingPasswordByEmail.consume = vi
				.fn()
				.mockResolvedValueOnce('');

			const { status, body } = await request(app)
				.post(`/account/requestResetPassword`)
				.send({
					email: user.email,
				});
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mjml2html).toHaveBeenCalledTimes(1);
			expect(mailgun.messages.create).toHaveBeenCalledTimes(1);
		});
		it('should send email and create a code and respond a success message if the email is exist', async () => {
			vi.mocked(mailgun.messages.create).mockResolvedValueOnce('' as any);
			limiterRequestResettingPasswordByEmail.consume = vi
				.fn()
				.mockResolvedValueOnce('');

			vi.spyOn(argon2, 'hash');

			const { status, body, headers } = await request(app)
				.post(`/account/requestResetPassword`)
				.send({
					email: user.email,
				});

			const newCode = await Code.findOne({
				email: user.email,
			}).exec();

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mailgun.messages.create).toHaveBeenCalledTimes(1);
			expect(argon2.hash).toHaveBeenCalledTimes(1);
			expect(newCode).not.toBeNull();
			expect(headers).toHaveProperty('expire-after');
		});
	});
	describe('POST /resetPassword', () => {
		beforeEach(async () => {
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);

			limiterVerifyCodeByEmail.consume = vi.fn().mockResolvedValueOnce('');

			const newCode = new Code({
				code: await argon2.hash(code),
				email: user.email,
			});

			await newCode.save();
		});
		it('should respond with a 401 status code and message if the session is not found', async () => {
			const { status, body } = await request(app).post(
				`/account/resetPassword`,
			);

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Session is invalid.');
		});
		it('should respond with a 403 status code and message if the CSRF token invalid', async () => {
			const agent = request.agent(app);

			await agent.post(`/account/verifyCode`).send({
				email: user.email,
				code,
			});

			const { status, body } = await agent.post(`/account/resetPassword`);
			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('CSRF token mismatch.');
		});
		it('should respond with a 400 status code and message if the password is not provided', async () => {
			const agent = request.agent(app);

			const verifyCodeResponse = await agent.post(`/account/verifyCode`).send({
				email: user.email,
				code,
			});

			const cookies = verifyCodeResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/account/resetPassword`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('password');
		});
		it('should respond with a 428 status code and message if the request reset password limiter is not consumed', async () => {
			const agent = request.agent(app);

			const verifyCodeResponse = await agent.post(`/account/verifyCode`).send({
				email: user.email,
				code,
			});

			const cookies = verifyCodeResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(null);

			const { status, body } = await agent
				.post(`/account/resetPassword`)
				.send({
					password,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(428);
			expect(body.success).toBe(false);
			expect(body.message).toBe('You have not applied to reset password.');
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			const agent = request.agent(app);

			const verifyCodeResponse = await agent.post(`/account/verifyCode`).send({
				email: user.email,
				code,
			});

			const cookies = verifyCodeResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(new RateLimiterRes());

			const { status, body, headers } = await agent
				.post(`/account/resetPassword`)
				.send({
					password,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it(`should respond success and reset user's password`, async () => {
			vi.mocked(mailgun.messages.create).mockResolvedValueOnce('' as any);
			const agent = request.agent(app);
			const verifyCodeResponse = await agent.post(`/account/verifyCode`).send({
				email: user.email,
				code,
			});
			const cookies = verifyCodeResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;
			vi.spyOn(argon2, 'hash');
			limiterRequestResettingPasswordByEmail.get = vi
				.fn()
				.mockResolvedValueOnce(
					new RateLimiterMemory({ points: 999, duration: 1 }),
				);
			const { status, body, headers } = await agent
				.post(`/account/resetPassword`)
				.send({
					password,
				})
				.set('x-csrf-token', `${token}.${value}`);
			const newPasswordUser = await User.findOne({ email: user.email }).exec();
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mailgun.messages.create).toHaveBeenCalledTimes(1);
			expect(mjml2html).toHaveBeenCalledTimes(1);
			expect(argon2.hash).toHaveBeenCalledTimes(1);
			expect(headers['set-cookie']).toStrictEqual([
				'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
				'id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
			]);
			expect(newPasswordUser?.password).not.toBe(user.password);
		});
	});
});
