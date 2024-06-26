import mongoose from "mongoose";

const Schema = mongoose.Schema;

const PostSchema = new Schema({
	author: {
		type: Schema.Types.ObjectId,
		ref: "User",
		required: true,
		immutable: true,
	},
	title: { type: String, required: true },
	content: { type: String, required: true },
	publish: { type: Boolean, required: true },
	lastModified: { type: Date, required: true },
	createdAt: { type: Date, immutable: true },
});

const PostModel = mongoose.model("Post", PostSchema);

export default PostModel;
