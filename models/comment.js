import mongoose from "mongoose";

const Schema = mongoose.Schema;

const CommentModel = mongoose.model(
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
export default CommentModel;
