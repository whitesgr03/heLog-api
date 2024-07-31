import mongoose from "mongoose";

const Schema = mongoose.Schema;

const PostSchema = new Schema(
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
		lastModified: { type: Date, required: true },
		createdAt: { type: Date, required: true, immutable: true },
	},
	{
		virtuals: {
			mainImageUrl: {
				get() {
					const source = this.mainImage?.match(
						/(?<=img src=")(.*?)(?=")/g
					);
					return source ? source[0] : null;
				},
			},
		},
		toJSON: { virtuals: true },
	}
);

const PostModel = mongoose.model("Post", PostSchema);

export default PostModel;
