import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/__test__/**/*.test.ts'],
		exclude: ['src/__test__/**/delete_*'],
		coverage: {
			include: ['src/**/*.ts'],
			exclude: ['src/**/delete_*'],
		},
		setupFiles: 'src/__test__/setup.js',
		env: {
			FACEBOOK_CLIENT_ID: 'mock_id',
			FACEBOOK_CLIENT_SECRET: 'mock_secret',
			GOOGLE_CLIENT_ID: 'mock_id',
			GOOGLE_CLIENT_SECRET: 'mock_secret',
			HELOG_API_URL: 'http://example.com',
			HELOG_URL: 'http://example2.com',
			SESSION_SECRETS: 'secrets',
			CSRF_SECRETS: 'secrets',
		},
	},
});
