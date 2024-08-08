import mongoose from "mongoose";

const Schema = mongoose.Schema;

const FederatedCredentialSchema = new Schema({
	user: {
		ref: "User",
		type: Schema.Types.ObjectId,
		required: true,
		immutable: true,
	},
	provider: { type: String, required: true, immutable: true },
	subject: { type: String, required: true, immutable: true },
});

const FederatedCredentialModel = mongoose.model(
	"FederatedCredential",
	FederatedCredentialSchema
);

export default FederatedCredentialModel;
