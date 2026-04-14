import mongoose from "mongoose";

const guardianSchema = new mongoose.Schema(
  {
    linkedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    relationship: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    consentGiven: {
      type: Boolean,
      required: true,
      default: false,
    },
    inviteToken: {
      type: String,
      default: null,
    },
    inviteTokenExpiry: {
      type: Date,
      default: null,
    },
    inviteAccepted: {
      type: Boolean,
      default: false,
    },
    firebaseUid: {
      type: String,
      default: null,
    },
    portalAccessEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Guardian = mongoose.model("Guardian", guardianSchema);
export default Guardian;