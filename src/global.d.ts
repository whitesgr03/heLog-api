import mongoose from 'mongoose';
import { Post } from './models/post.ts';
import { CommentDocument } from './models/comment.ts';
import { PostDocument } from './models/post.ts';

declare global {
	namespace Express {
		interface Request {
			data: Record<string, any>; // express validator req.data
			post: PostDocument;
			comment: CommentDocument;
			reply: CommentDocument;
		}
		interface User {
			id: mongoose.Types.ObjectId; // passport req.user
		}
	}
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV: 'production' | 'development' | 'test';
			DB: string;
			SERVER: string;
			PORT: string;
			FACEBOOK_CLIENT_ID: string;
			FACEBOOK_CLIENT_SECRET: string;
			GOOGLE_CLIENT_ID: string;
			GOOGLE_CLIENT_SECRET: string;
			HELOG_API_URL: string;
			HELOG_URL: string;
			DOMAIN: string;
			DATABASE_STRING: string;
			SESSION_SECRETS: string;
			CSRF_SECRETS: string;
			MAILGUN_API_KEY: string;
			MAILGUN_DOMAIN: string;
		}
	}
}

export {};
