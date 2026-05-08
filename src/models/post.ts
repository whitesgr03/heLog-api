import { Schema, model, HydratedDocument, InferSchemaType } from 'mongoose';

const postSchema = new Schema(
	{
		author: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			immutable: true,
		},
		title: { type: String },
		mainImage: { type: String },
		content: { type: String },
		publish: { type: Boolean, default: false },
	},
	{
		timestamps: true,
	},
);

export type PostDocument = HydratedDocument<InferSchemaType<typeof postSchema>>;

export const Post = model('Post', postSchema);
