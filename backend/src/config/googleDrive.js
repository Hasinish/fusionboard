import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

// Helper to create a fresh OAuth2 client with the correct redirect URI
export const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:5001/api/drive/callback"
  );
};

// This one is used for the initial auth flow (getting the code/token)
const oauth2Client = createOAuth2Client();

// plug the global refresh token in for any non-workspace-specific operations (backward compat)
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

// This one is a pre-configured drive client using the global refresh token
const driveClient = google.drive({
  version: "v3",
  auth: oauth2Client,
});


export { oauth2Client, driveClient };
export default driveClient;

