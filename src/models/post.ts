import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const postSchema = {
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
};

export type PostDocument = mongoose.Document &
	mongoose.InferRawDocType<typeof postSchema>;

export const Post = mongoose.model(
	'Post',
	new Schema<PostDocument>(postSchema, {
		timestamps: true,
	}),
);
