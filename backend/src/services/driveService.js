// backend/src/services/driveService.js
import { google } from "googleapis";
import { createOAuth2Client } from "../config/googleDrive.js";

/*
  spins up a fresh google drive client for whatever workspace is asking for it,
  using that specific workspace owner's refresh token
*/
export function getDriveClient(refreshToken) {
    const client = createOAuth2Client();

    client.setCredentials({
        refresh_token: refreshToken,
    });

    return google.drive({
        version: "v3",
        auth: client,
    });
}

