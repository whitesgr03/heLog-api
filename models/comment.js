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
			content: { type: String, required: true },
			deleted: { type: Boolean },
		},
		{ timestamps: true }
	)
);
