// backend/src/services/driveService.js
import { google } from "googleapis";
import { oauth2Client } from "../config/googleDrive.js";

/**
 * Creates a Google Drive client for a specific workspace using its refresh token.
 * @param {string} refreshToken - The refresh token of the workspace owner.
 * @returns {object} Google Drive client instance.
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
