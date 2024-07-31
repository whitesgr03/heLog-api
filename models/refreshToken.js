import mongoose from "mongoose";

const Schema = mongoose.Schema;

const RefreshTokenSchema = new Schema({
	user: {
		type: Schema.Types.ObjectId,
		required: true,
		immutable: true,
	},
	token: { type: String, required: true, immutable: true },
	notBefore: { type: Date, required: true },
	expiresAfter: {
		type: Date,
		required: true,
		immutable: true,
	},
});

RefreshTokenSchema.index({ expiresAfter: 1 }, { expireAfterSeconds: 1 });

const RefreshTokenModel = mongoose.model("RefreshToken", RefreshTokenSchema);

export default RefreshTokenModel;
