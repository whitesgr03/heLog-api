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
}

export {};
