// backend/generate-token.js
import { google } from "googleapis";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing in .env");
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive"],
    prompt: "consent", // Force to get refresh token
});

console.log("\n--- GOOGLE DRIVE TOKEN GENERATOR ---");
console.log("1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n2. Log in, click AUTHORIZE, and you will be redirected.");
console.log("3. Copy the 'Authorization Code' from the browser (it might be in the URL or on screen).");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question("\n4. Paste the Authorization Code here: ", async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log("\n✅ SUCCESS!");
        console.log("Here is your new Refresh Token:\n");
        console.log(tokens.refresh_token);
        console.log("\n5. Copy this token and update GOOGLE_REFRESH_TOKEN in your backend/.env file.");
        console.log("6. Then restart your backend server.");
    } catch (error) {
        console.error("\n❌ FAILED to exchange code for tokens:", error.message);
    } finally {
        rl.close();
    }
});
