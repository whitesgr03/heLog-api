import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const commentSchema = {
	author: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		immutable: true,
	},
	post: {
		type: Schema.Types.ObjectId,
		ref: 'Post',
		required: true,
		immutable: true,
	},
	parent: {
		type: Schema.Types.ObjectId,
		ref: 'Comment',
		immutable: true,
	},
	child: [
		{
			type: Schema.Types.ObjectId,
			ref: 'Comment',
		},
	],
	reply: {
		type: Schema.Types.ObjectId,
		ref: 'Comment',
		immutable: true,
	},
	content: { type: String, required: true },
	deleted: { type: Boolean, default: false },
};

export type CommentDocument = mongoose.Document &
	mongoose.InferRawDocType<typeof commentSchema>;

export const Comment = mongoose.model(
	'Comment',
	new Schema<CommentDocument>(commentSchema, { timestamps: true }),
);
