import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:5001/api/drive/callback"
);

// plug the refresh token in so we don't have to keep logging in
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const driveClient = google.drive({
  version: "v3",
  auth: oauth2Client,
});

export { oauth2Client, driveClient };
export default driveClient;
