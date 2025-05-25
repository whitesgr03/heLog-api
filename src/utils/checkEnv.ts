const envConfig = {
	DEBUG: process.env.DEBUG,
	FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID,
	FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_ID,
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	ALLOW_CLIENT_ORIGINS: process.env.ALLOW_CLIENT_ORIGINS,
	ALLOW_REDIRECT_URLS: process.env.ALLOW_REDIRECT_URLS,
	HELOG_API_URL: process.env.HELOG_API_URL,
	HELOG_URL: process.env.HELOG_URL,
	DATABASE_STRING: process.env.DATABASE_STRING,
	SESSION_SECRETS: process.env.SESSION_SECRETS,
	CSRF_SECRETS: process.env.CSRF_SECRETS,
	PORT: process.env.PORT,
};

export const checkEnv = () =>
	Object.entries(envConfig)
		.filter(item => item[1] === undefined)
		.map(item => item[0]);
