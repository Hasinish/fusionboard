// backend/src/services/driveService.js
import { google } from "googleapis";
import { oauth2Client } from "../config/googleDrive.js";

/*
  spins up a fresh google drive client for whatever workspace is asking for it,
  using that specific workspace owner's refresh token
*/
export function getDriveClient(refreshToken) {
    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:5001/api/drive/callback"
    );

    client.setCredentials({
        refresh_token: refreshToken,
    });

    return google.drive({
        version: "v3",
        auth: client,
    });
}
