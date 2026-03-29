import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, uppercase: true },
    countryName: String,
    currencyCode: { type: String, required: true, uppercase: true },
    currencySymbol: String,
    joinCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  },
  { timestamps: true }
);

export const Company = mongoose.model('Company', companySchema);
