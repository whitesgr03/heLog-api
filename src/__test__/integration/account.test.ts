import { expect, describe, it, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { RateLimiterMongo } from 'rate-limiter-flexible';
import { mongoose } from '../../config/database.js';

import { User } from '../../models/user.js';
import { Token } from '../../models/token.js';
import { Code } from '../../models/code.js';
import { UserDocument } from '../../models/user.js';

import { accountRouter } from '../../routes/account.js';
import passport from 'passport';

import { sendEmail } from '../../utils/sendEmail.js';
import { hash, verify } from 'argon2';
import {
	limiterLoginFailsByEmail,
	limiterRequestRegistrationByIp,
	limiterRequestResettingPasswordByEmail,
	limiterVerifyCodeByEmail,
} from '../../utils/rateLimiter.js';
import { generateCSRFToken } from '../../utils/generateCSRFToken.js';

vi.mock('argon2');
vi.mock('../../utils/sendEmail.js');
vi.mock('../../utils/rateLimiter.js', () => ({
	limiterLoginFailsByEmail: new RateLimiterMongo({
		keyPrefix: 'tests_limiter_login',
		storeClient: mongoose.connection,
		points: 999,
		duration: 1,
	}),
	limiterRequestRegistrationByIp: new RateLimiterMongo({
		keyPrefix: 'test_request_register',
		storeClient: mongoose.connection,
		points: 999,
		duration: 1,
	}),
	limiterRequestResettingPasswordByEmail: new RateLimiterMongo({
		keyPrefix: 'test_request_reset_password',
		storeClient: mongoose.connection,
		points: 999,
		duration: 1,
	}),
	limiterVerifyCodeByEmail: new RateLimiterMongo({
		keyPrefix: 'test_verify_code',
		storeClient: mongoose.connection,
		points: 999,
		duration: 1,
	}),
}));

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
app.use('/', accountRouter);

describe('Account paths', () => {
	const emailForTest = 'example@gmail.com';

	describe('GET /oauth2/redirect/:federation', () => {
		it('should redirect to federation sign page', async () => {
			const mockFederation = 'google';
			const mockAuthenticateFn = vi.fn((_, res) => res.end());
			passport.authenticate = vi.fn(mockAuthenticateFn);

			await request(app).get(`/login/${mockFederation}`);

			expect(passport.authenticate).toHaveBeenCalledTimes(1);
			expect(passport.authenticate).toHaveBeenCalledWith(mockFederation);
			expect(mockAuthenticateFn).toHaveBeenCalledTimes(1);
		});
	});
	describe('GET /oauth2/redirect/:federation', () => {
		it('should redirect to sign in page if the query code is not found', async () => {
			const { status, headers } = await request(app).get(
				`/oauth2/redirect/google`,
			);

			expect(status).toBe(302);
			expect(headers['location']).toBe(`${process.env.HELOG_ACCOUNT}/sign-in`);
		});
		it('should respond a session and login user', async () => {
			const mockCode = '123';

			const mockAuthenticateFn = vi.fn();
			passport.authenticate = vi.fn((_, fn) => {
				fn(null, true);
				return mockAuthenticateFn;
			});

			const { status, headers } = await request(app).get(
				`/oauth2/redirect/google?code=${mockCode}`,
			);

			expect(status).toBe(302);
			expect(headers).toHaveProperty('cache-control');
			expect(headers['set-cookie'][0]).toMatch(/token=/);
			expect(headers['set-cookie'][1]).toMatch(/id=/);
			expect(passport.authenticate).toHaveBeenCalledTimes(1);
			expect(mockAuthenticateFn).toHaveBeenCalledTimes(1);
		});
	});
	describe('POST /login', () => {
		it('should respond with a 400 status code and message if the email or password is not provided', async () => {
			const { status, body } = await request(app).post(`/login`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
			expect(body.fields).toHaveProperty('password');
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterLoginFailsByEmail.points = 0;
			const { status, body, headers } = await request(app).post(`/login`).send({
				email: 'emily',
				password: 'password',
			});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 401 status code and message if the email or password is invalid', async () => {
			const email = emailForTest;
			const password = '123456';

			const mockAuthenticateFn = vi.fn();
			passport.authenticate = vi.fn((_, fn) => {
				fn(null, null);
				return mockAuthenticateFn;
			});

			limiterLoginFailsByEmail.points = 999;
			const { status, body } = await request(app).post(`/login`).send({
				email: email,
				password: password,
			});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
			expect(body.fields).toHaveProperty('password');
			expect(passport.authenticate).toHaveBeenCalledTimes(1);
			expect(mockAuthenticateFn).toHaveBeenCalledTimes(1);
		});
		it('should respond a session and login user', async () => {
			const email = emailForTest;
			const password = '123456';

			const mockAuthenticateFn = vi.fn();
			passport.authenticate = vi.fn((_, fn) => {
				fn(null, true);
				return mockAuthenticateFn;
			});

			vi.mocked(verify).mockResolvedValueOnce(true);

			limiterLoginFailsByEmail.points = 999;
			const { status, body, headers } = await request(app).post(`/login`).send({
				email,
				password,
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(headers).toHaveProperty('cache-control');
			expect(headers['set-cookie'][0]).toMatch(/token=/);
			expect(headers['set-cookie'][1]).toMatch(/id=/);
			expect(passport.authenticate).toHaveBeenCalledTimes(1);
			expect(mockAuthenticateFn).toHaveBeenCalledTimes(1);
		});
	});
	describe('POST /logout', () => {
		it('should respond with a 401 status code and message if the user is not logged in', async () => {
			const { status, body } = await request(app).post(`/logout`);

			expect(status).toBe(401);
			expect(body).toStrictEqual({
				success: false,
				message: 'Missing authentication token.',
			});
		});
		it('should respond with a 403 status code and message if a CSRF token is incorrect', async () => {
			await import('../../lib/passport.js');

			const user = (await User.findOne({}).exec()) as UserDocument;

			const agent = request.agent(app);

			await agent.post(`/login`).send({ email: user.email, password: ' ' });

			const { status, body } = await agent.post(`/logout`);

			expect(status).toBe(403);
			expect(body).toStrictEqual({
				success: false,
				message: 'CSRF token mismatch.',
			});
		});
		it(`should logout user`, async () => {
			await import('../../lib/passport.js');

			const user = (await User.findOne({}).exec()) as UserDocument;
			const agent = request.agent(app);

			const loginResponse = await agent
				.post(`/login`)
				.send({ email: user.email, password: ' ' });

			const cookies = loginResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body, headers } = await agent
				.post(`/logout`)
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
	describe('POST /requestRegister', () => {
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterRequestRegistrationByIp.points = 0;
			const { status, body, headers } = await request(app)
				.post(`/requestRegister`)
				.send({
					username: 'test',
					email: emailForTest,
					password: '12345678',
					confirmPassword: '12345678',
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 400 status code and message if the input data is incorrect', async () => {
			const { status, body } = await request(app)
				.post(`/requestRegister`)
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
		it('should send email and respond a success message if the email is exist', async () => {
			limiterRequestRegistrationByIp.points = 999;
			const user = (await User.findOne({}).exec()) as UserDocument;

			const { status, body } = await request(app)
				.post(`/requestRegister`)
				.send({
					username: 'test',
					email: user.email,
					password: '12345678',
					confirmPassword: '12345678',
				});
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(sendEmail).toHaveBeenCalledTimes(1);
		});
		it('should send email can create a new user and token and respond a success message if the email is not found', async () => {
			limiterRequestRegistrationByIp.points = 999;
			const mockPassword = '123';
			const mockToken = '456';
			const mockUsername = 'example';

			vi.mocked(hash)
				.mockResolvedValueOnce(mockPassword)
				.mockResolvedValueOnce(mockToken);

			const { status, body } = await request(app)
				.post(`/requestRegister`)
				.send({
					username: mockUsername,
					email: emailForTest,
					password: '12345678',
					confirmPassword: '12345678',
				});

			const newUser = await User.findOne({
				username: mockUsername,
				password: mockPassword,
			}).exec();
			const newToken = await Token.findOne({ token: mockToken }).exec();

			expect(status).toBe(200);
			// expect(body.success).toBe(true);
			// expect(body.message).toBe('The verification token is sending');
			// expect(sendEmail).toHaveBeenCalledTimes(1);
			// expect(hash).toHaveBeenCalledTimes(2);
			// expect(newUser).not.toBeNull();
			// expect(newToken).not.toBeNull();
		});
	});
	describe('POST /register', () => {
		const IP_FOR_TEST = '::ffff:127.0.0.1';
		it('should respond with a 428 status code and message if the request registration limiter is not consumed', async () => {
			await limiterRequestRegistrationByIp.delete(IP_FOR_TEST);
			const { status, body } = await request(app).post(`/register`);
			expect(status).toBe(428);
			expect(body.success).toBe(false);
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			await limiterRequestRegistrationByIp.consume(IP_FOR_TEST);
			limiterRequestRegistrationByIp.points = 0;
			const { status, body, headers } = await request(app).post(`/register`);
			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 401 status code and message if token is not provided', async () => {
			limiterRequestRegistrationByIp.points = 999;

			const { status, body } = await request(app).post(`/register`).send({
				tokenId: '123',
			});
			expect(status).toBe(401);
			expect(body.success).toBe(false);
		});
		it('should respond with a 401 status code and message if token is not found', async () => {
			limiterRequestRegistrationByIp.points = 999;

			const { status, body } = await request(app).post(`/register`).send({
				tokenId: new mongoose.Types.ObjectId(),
			});
			expect(status).toBe(401);
			expect(body.success).toBe(false);
		});
		it('should respond with a 401 status code and message if token is invalid', async () => {
			limiterRequestRegistrationByIp.points = 999;
			const newUser = new User({
				username: 'user',
				password: 'password',
				isAdmin: false,
			});
			const newToken = new Token({
				user: newUser.id,
				token: 'token',
				email: emailForTest,
			});

			await Promise.all([newUser.save(), newToken.save()]);

			vi.mocked(verify).mockResolvedValueOnce(false);

			const { status, body } = await request(app).post(`/register`).send({
				tokenId: newToken.id,
				token: newToken.token,
			});
			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(verify).toHaveBeenCalledTimes(1);
			expect(verify).toHaveBeenCalledWith(newToken.token, newToken.token);
		});
		it('should response success and create a new account', async () => {
			limiterRequestRegistrationByIp.points = 999;
			const newUser = new User({
				username: 'user',
				password: 'password',
				isAdmin: false,
			});
			const newToken = new Token({
				user: newUser.id,
				token: 'token',
				email: emailForTest,
			});

			await Promise.all([newUser.save(), newToken.save()]);

			vi.mocked(verify).mockResolvedValueOnce(true);

			const { status, body } = await request(app).post(`/register`).send({
				tokenId: newToken.id,
				token: newToken.token,
			});

			const user = await User.findOne({ email: newToken.email }).exec();
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(user).not.toBeNull();
		});
	});
	describe('POST /requestResetPassword', () => {
		it('should respond with a 400 status code and message if the email is not provided', async () => {
			const { status, body } = await request(app).post(`/requestResetPassword`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterRequestResettingPasswordByEmail.points = 0;
			const { status, body, headers } = await request(app)
				.post(`/requestResetPassword`)
				.send({
					email: emailForTest,
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should send email and respond a success message if the email is not found', async () => {
			limiterRequestResettingPasswordByEmail.points = 999;

			const { status, body } = await request(app)
				.post(`/requestResetPassword`)
				.send({
					email: emailForTest,
				});
			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(sendEmail).toHaveBeenCalledTimes(1);
		});
		it('should send email and create a code and respond a success message if the email is exist', async () => {
			limiterRequestResettingPasswordByEmail.points = 999;

			const mockCode = '456';

			const user = (await User.findOne({}).exec()) as UserDocument;

			vi.mocked(hash).mockResolvedValueOnce(mockCode);

			const { status, body, headers } = await request(app)
				.post(`/requestResetPassword`)
				.send({
					email: user.email,
				});

			const newCode = await Code.findOne({
				email: user.email,
				code: mockCode,
			}).exec();

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(sendEmail).toHaveBeenCalledTimes(1);
			expect(hash).toHaveBeenCalledTimes(1);
			expect(newCode).not.toBeNull();
			expect(headers).toHaveProperty('expire-after');
		});
	});
	describe('POST /verifyCode', () => {
		it('should respond with a 400 status code and message if the input data is incorrect', async () => {
			const { status, body } = await request(app).post(`/verifyCode`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
			expect(body.fields).toHaveProperty('code');
		});
		it('should respond with a 428 status code and message if the request reset password limiter is not consumed', async () => {
			const mockEmail = emailForTest;

			await limiterRequestResettingPasswordByEmail.delete(mockEmail);
			const { status, body } = await request(app).post(`/verifyCode`).send({
				email: mockEmail,
				code: '123456',
			});

			expect(status).toBe(428);
			expect(body.success).toBe(false);
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			const mockEmail = emailForTest;
			await limiterRequestResettingPasswordByEmail.consume(mockEmail);
			limiterRequestResettingPasswordByEmail.points = 0;
			const { status, body, headers } = await request(app)
				.post(`/verifyCode`)
				.send({
					email: mockEmail,
					code: '123456',
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 401 status code and message if the server is blocked by the rate limiter', async () => {
			const mockEmail = emailForTest;
			limiterRequestResettingPasswordByEmail.points = 999;
			await limiterRequestResettingPasswordByEmail.consume(mockEmail);
			limiterVerifyCodeByEmail.points = 0;
			const { status, body } = await request(app).post(`/verifyCode`).send({
				email: mockEmail,
				code: '123456',
			});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
		});
		it('should respond with a 401 status code and message if the code is not found', async () => {
			const mockEmail = emailForTest;
			limiterRequestResettingPasswordByEmail.points = 999;
			await limiterRequestResettingPasswordByEmail.consume(mockEmail);
			await limiterVerifyCodeByEmail.delete(mockEmail);
			limiterVerifyCodeByEmail.points = 999;

			const { status, body } = await request(app).post(`/verifyCode`).send({
				email: mockEmail,
				code: '123456',
			});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Code is invalid.');
		});
		it('should respond with a 401 status code and message if the code is invalid', async () => {
			const mockEmail = emailForTest;
			const mockCode = '123456';
			limiterRequestResettingPasswordByEmail.points = 999;
			await limiterRequestResettingPasswordByEmail.consume(mockEmail);
			await limiterVerifyCodeByEmail.delete(mockEmail);
			limiterVerifyCodeByEmail.points = 999;

			const newCode = new Code({
				code: mockCode,
				email: mockEmail,
			});

			await newCode.save();

			vi.mocked(verify).mockResolvedValueOnce(false);

			const { status, body } = await request(app).post(`/verifyCode`).send({
				email: mockEmail,
				code: mockCode,
			});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(body.message).toBe('Code is invalid.');
			expect(verify).toHaveBeenCalledTimes(1);
			expect(verify).toHaveBeenCalledWith(mockCode, mockCode);
		});
		it('should respond a session and success message', async () => {
			const mockEmail = emailForTest;
			const mockCode = '123456';
			limiterRequestResettingPasswordByEmail.points = 999;
			await limiterRequestResettingPasswordByEmail.consume(mockEmail);
			await limiterVerifyCodeByEmail.delete(mockEmail);
			limiterVerifyCodeByEmail.points = 999;

			const newCode = new Code({
				code: mockCode,
				email: mockEmail,
			});

			await newCode.save();

			vi.mocked(verify).mockResolvedValueOnce(true);

			const { status, body, headers } = await request(app)
				.post(`/verifyCode`)
				.send({
					email: mockEmail,
					code: mockCode,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(headers).toHaveProperty('expire-after');
			expect(headers).toHaveProperty('cache-control');
			expect(headers['set-cookie'][0]).toMatch(/token=/);
			expect(headers['set-cookie'][1]).toMatch(/id=/);
		});
	});
	describe('POST /requestVerificationCode', () => {
		it('should respond with a 400 status code and message if the input data is incorrect', async () => {
			const { status, body, headers } = await request(app).post(
				`/requestVerificationCode`,
			);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('email');
		});
		it('should respond with a 428 status code and message if the request reset password limiter is not consumed', async () => {
			await limiterRequestResettingPasswordByEmail.delete(emailForTest);
			const { status, body } = await request(app)
				.post(`/requestVerificationCode`)
				.send({
					email: emailForTest,
				});

			expect(status).toBe(428);
			expect(body.success).toBe(false);
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			await limiterRequestResettingPasswordByEmail.consume(emailForTest);
			limiterRequestResettingPasswordByEmail.points = 0;
			const { status, body, headers } = await request(app)
				.post(`/requestVerificationCode`)
				.send({
					email: emailForTest,
				});

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 401 status code and message if the code is not found', async () => {
			limiterRequestResettingPasswordByEmail.points = 999;
			await limiterRequestResettingPasswordByEmail.consume(emailForTest);
			const mockCode = '456';

			vi.mocked(hash).mockResolvedValueOnce(mockCode);

			const { status, body } = await request(app)
				.post(`/requestVerificationCode`)
				.send({
					email: emailForTest,
				});

			expect(status).toBe(401);
			expect(body.success).toBe(false);
		});
		it('should send email and create a code and respond a success message if the email is exist', async () => {
			limiterRequestResettingPasswordByEmail.points = 999;
			await limiterRequestResettingPasswordByEmail.consume(emailForTest);
			const mockCode = '456';

			const newCode = new Code({
				code: '123456',
				email: emailForTest,
			});

			await newCode.save();

			vi.mocked(hash).mockResolvedValueOnce(mockCode);

			const { status, body } = await request(app)
				.post(`/requestVerificationCode`)
				.send({
					email: emailForTest,
				});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(sendEmail).toHaveBeenCalledTimes(1);
			expect(hash).toHaveBeenCalledTimes(1);
		});
	});
	describe('POST /resetPassword', () => {
		beforeAll(() => {
			app.post('/createResetPasswordSession', (req, res) => {
				const fifteenMins = 15 * 60 * 1000;

				req.session.cookie.maxAge = fifteenMins;
				req.session.email = req.body.email;
				res.cookie('token', generateCSRFToken(req.sessionID)).end();
			});
		});
		it('should respond with a 401 status code and message if the session is not found', async () => {
			const { status, body } = await request(app).post(`/resetPassword`);

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(body.message).toBe('The credential is invalid.');
		});
		it('should respond with a 403 status code and message if the CSRF token invalid', async () => {
			const agent = request.agent(app);

			await agent.post(`/createResetPasswordSession`).send({
				email: emailForTest,
			});

			const { status, body } = await agent.post(`/resetPassword`);
			expect(status).toBe(403);
			expect(body.success).toBe(false);
			expect(body.message).toBe('CSRF token mismatch.');
		});
		it('should respond with a 400 status code and message if the password is not provided', async () => {
			const agent = request.agent(app);

			const createResetPasswordResponse = await agent
				.post(`/createResetPasswordSession`)
				.send({
					email: emailForTest,
				});

			const cookies = createResetPasswordResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/resetPassword`)
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.fields).toHaveProperty('password');
		});
		it('should respond with a 428 status code and message if the request reset password limiter is not consumed', async () => {
			await limiterRequestResettingPasswordByEmail.delete(emailForTest);
			const agent = request.agent(app);

			const createResetPasswordResponse = await agent
				.post(`/createResetPasswordSession`)
				.send({
					email: emailForTest,
				});

			const cookies = createResetPasswordResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body } = await agent
				.post(`/resetPassword`)
				.send({
					password: 12345678,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(428);
			expect(body.success).toBe(false);
			expect(body.message).toBe('You have not applied to reset password.');
		});
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			await limiterRequestResettingPasswordByEmail.consume(emailForTest);
			limiterRequestResettingPasswordByEmail.points = 0;
			const agent = request.agent(app);

			const createResetPasswordResponse = await agent
				.post(`/createResetPasswordSession`)
				.send({
					email: emailForTest,
				});

			const cookies = createResetPasswordResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body, headers } = await agent
				.post(`/resetPassword`)
				.send({
					password: 12345678,
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(429);
			expect(body.success).toBe(false);
			expect(headers).toHaveProperty('retry-after');
		});
		it('should respond with a 401 status code and message if the session is expired', async () => {
			const mockPassword = '88888888';
			limiterRequestResettingPasswordByEmail.points = 999;
			await limiterRequestResettingPasswordByEmail.consume(emailForTest);
			const agent = request.agent(app);

			vi.mocked(hash).mockResolvedValueOnce(mockPassword);

			const createResetPasswordResponse = await agent
				.post(`/createResetPasswordSession`)
				.send({
					email: emailForTest,
				});

			const cookies = createResetPasswordResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const { status, body, headers } = await agent
				.post(`/resetPassword`)
				.send({
					password: '12345678',
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(401);
			expect(body.success).toBe(false);
			expect(hash).toHaveBeenCalledTimes(1);
		});
		it(`should respond success and reset user's password`, async () => {
			const mockPassword = '88888888';
			limiterRequestResettingPasswordByEmail.points = 999;
			await limiterRequestResettingPasswordByEmail.consume(emailForTest);
			const agent = request.agent(app);

			vi.mocked(hash).mockResolvedValueOnce(mockPassword);

			const createResetPasswordResponse = await agent
				.post(`/createResetPasswordSession`)
				.send({
					email: emailForTest,
				});

			const cookies = createResetPasswordResponse.headers['set-cookie'];
			const [_, token, value] = cookies[0].match(
				/(?<=token=)(\w+).(\w+)(?=;)/,
			) as RegExpMatchArray;

			const newUser = new User({
				username: 'user',
				password: 'password',
				email: emailForTest,
				isAdmin: false,
			});

			await newUser.save();

			const { status, body, headers } = await agent
				.post(`/resetPassword`)
				.send({
					password: '12345678',
				})
				.set('x-csrf-token', `${token}.${value}`);

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(sendEmail).toHaveBeenCalledTimes(1);
			expect(hash).toHaveBeenCalledTimes(1);
			expect(headers['set-cookie'][0]).toMatch(/token=;/);
			expect(headers['set-cookie'][1]).toMatch(/id=;/);
		});
	});
});
