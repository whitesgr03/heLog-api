import { RateLimiterRes } from 'rate-limiter-flexible';
import { expect, describe, it, vi } from 'vitest';
import request from 'supertest';

import { limiterBruteForceByIp } from '../../utils/rateLimiter.js';

import createApp from '../../app';

vi.mock('../../config/database.js');
vi.mock('./routes/account.js');
vi.mock('./routes/blog.js');
vi.mock('./routes/user.js');

const app = createApp();

describe('App', () => {
	describe('GET / path', () => {
		it('should respond with a 429 status code and message if the server is blocked by the rate limiter', async () => {
			limiterBruteForceByIp.consume = vi
				.fn()
				.mockRejectedValueOnce(new RateLimiterRes());

			const { status, body } = await request(app).get(`/`);

			expect(status).toBe(429);
			expect(body.success).toBe(false);
		});
		it('should response with no access-control-allow-origin header', async () => {
			const { headers } = await request(app).get(`/`);

			expect(headers['access-control-allow-origin']).toBeUndefined();
		});
		it('should respond with a 204 status code and allowed Access-Control-Request method and headers, if request headers include not allowed method and headers', async () => {
			const mockMethod = 'HEAD';
			const mockHeaders = 'X-HEADERS';
			const { status, headers } = await request(app)
				.options(`/`)
				.set('Origin', 'http://localhost')
				.set('Access-Control-Request-Method', mockMethod)
				.set('Access-Control-Request-Headers', mockHeaders);

			expect(status).toBe(204);
			expect(headers['access-control-allow-methods']).not.toContain(mockMethod);
			expect(headers['access-control-allow-headers']).not.toContain(
				mockHeaders,
			);
			expect(headers['access-control-allow-methods']).toBe(
				'GET,POST,PATCH,DELETE',
			);
			expect(headers['access-control-allow-headers']).toBe(
				'Content-Type,X-CSRF-TOKEN',
			);
		});
		it('should respond with a 404 status code if request endpoint is not found', async () => {
			const { status, body } = await request(app).get(`/unknown`);

			expect(status).toBe(404);
			expect(body.message).toBe(
				'The endpoint you are looking for cannot be found.',
			);
		});
		it('should response with access-control-allow-origin header and redirect to home page', async () => {
			const { status, headers } = await request(app)
				.get(`/`)
				.set('Origin', 'http://localhost');

			expect(status).toBe(302);
			expect(headers['location']).toBe(process.env.HELOG_URL);
			expect(headers['access-control-allow-origin']).not.toBeUndefined();
		});
	});
	describe('GET /favicon.ico', () => {
		it('should respond with a 204 status code', async () => {
			const { status } = await request(app).get(`/favicon.ico`);

			expect(status).toBe(204);
		});
	});
	describe('GET /robots.txt', () => {
		it('should send plain text', async () => {
			const { status, type, text } = await request(app).get(`/robots.txt`);

			expect(status).toBe(200);
			expect(type).toBe('text/plain');
			expect(text.trim()).toBe('User-agent: *\nDisallow: /');
		});
	});
});
