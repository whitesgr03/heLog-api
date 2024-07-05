import mongoose from "mongoose";

const Schema = mongoose.Schema;

const AuthCodeSchema = new Schema({
	session: {
		type: String,
		required: true,
		immutable: true,
	},
	code: {
		type: String,
		required: true,
		immutable: true,
	},
	code_challenge: {
		type: String,
		required: true,
		immutable: true,
	},
	code_challenge_method: {
		type: String,
		required: true,
		immutable: true,
	},
	scope: {
		type: String,
		required: true,
		immutable: true,
	},
	expiresAfter: {
		type: Date,
		required: true,
		default: new Date(Date.now() + 60 * 1000),
		immutable: true,
	},
});

AuthCodeSchema.index({ expiresAfter: 1 }, { expireAfterSeconds: 1 });

const AuthCodeModel = mongoose.model("AuthCode", AuthCodeSchema);

export default AuthCodeModel;
