// backend/test-drive.js
import driveClient from "./src/config/googleDrive.js"; // This imports your NEW OAuth config
import dotenv from "dotenv";

dotenv.config();

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

console.log("--- GOOGLE DRIVE OAUTH DIAGNOSTIC ---");

async function testUpload() {
  try {
    if (!FOLDER_ID) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID in .env");

    console.log("1. Attempting Upload via OAuth...");
    
    // Attempt to create a file
    const res = await driveClient.files.create({
      requestBody: {
        name: "oauth_test_success.txt",
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: "text/plain",
        body: "If you read this, FusionBoard OAuth is working!",
      },
    });

    console.log("✅ SUCCESS! File uploaded.");
    console.log(`   File ID: ${res.data.id}`);
    console.log("   (This means your backend can now upload files as YOU!)");
    
    // Cleanup
    await driveClient.files.delete({ fileId: res.data.id });
    console.log("✅ Test file deleted.");

  } catch (error) {
    console.error("\n❌ FAILED:", error.message);
    
    if (error.message.includes("invalid_grant")) {
        console.error("👉 CAUSE: Your REFRESH TOKEN in .env is invalid or expired.");
    } else if (error.message.includes("not found")) {
        console.error("👉 CAUSE: Folder ID is wrong, or the path to config/googleDrive.js is wrong.");
    }
  }
}

testUpload();