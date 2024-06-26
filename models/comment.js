import mongoose from "mongoose";

const Schema = mongoose.Schema;

const CommentSchema = new Schema({
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
	lastModified: { type: Date, required: true },
	createdAt: { type: Date, immutable: true },
	reply: { type: Schema.Types.ObjectId, ref: "Comment", immutable: true },
});

const CommentModel = mongoose.model("Comment", CommentSchema);

export default CommentModel;
