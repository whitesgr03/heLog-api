const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const PostSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: "User", required: true },
	title: { type: String, required: true },
	content: { type: String, required: true },
	lastModified: { type: Date, required: true },
	createdAt: { type: Date, immutable: true },
});

const PostModel = mongoose.model("Post", PostSchema);

module.exports = PostModel;
