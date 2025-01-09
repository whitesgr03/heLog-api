import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const Comment = mongoose.model(
	"Comment",
	new Schema(
		{
			author: {
				type: Schema.Types.ObjectId,
				ref: "User",
				required: true,
				immutable: true,
			},
			post: {
				type: Schema.Types.ObjectId,
				ref: "Post",
				required: true,
				immutable: true,
			},
			parent: {
				type: Schema.Types.ObjectId,
				ref: "Comment",
				immutable: true,
			},
			reply: {
				type: Schema.Types.ObjectId,
				ref: "Reply",
				immutable: true,
			},
			content: { type: String, required: true },
			deleted: { type: Boolean, default: false },
		},
		{ timestamps: true }
	)
);
