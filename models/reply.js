import mongoose from "mongoose";

const Schema = mongoose.Schema;

const ReplySchema = new Schema({
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
	comment: {
		type: Schema.Types.ObjectId,
		ref: "Comment",
		required: true,
		immutable: true,
	},
	reply: { type: Schema.Types.ObjectId, ref: "Reply", immutable: true },
	content: { type: String, required: true },
	lastModified: { type: Date, required: true },
	createdAt: { type: Date, immutable: true },
	deleted: { type: Boolean },
});

const ReplyModel = mongoose.model("Reply", ReplySchema);

export default ReplyModel;
