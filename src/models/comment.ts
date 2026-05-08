import { Schema, HydratedDocument, InferSchemaType, model } from 'mongoose';

const commentSchema = new Schema(
	{
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
	},
	{
		timestamps: true,
	},
);

export type CommentDocument = HydratedDocument<
	InferSchemaType<typeof commentSchema>
>;

export const Comment = model('Comment', commentSchema);
