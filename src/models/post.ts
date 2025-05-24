import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const Post = mongoose.model(
	"Post",
	new Schema(
		{
			author: {
				type: Schema.Types.ObjectId,
				ref: "User",
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
		}
	)
);
