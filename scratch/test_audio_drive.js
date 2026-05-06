import mongoose from "mongoose";
import Workspace from "../backend/src/models/Workspace.js";
import RecordingSession from "../backend/src/models/RecordingSession.js";
import { getDriveClient } from "../backend/src/services/driveService.js";
import { Readable } from "stream";
import dotenv from "dotenv";

dotenv.config({ path: "../backend/.env" });

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    // 1. Find a workspace with Drive connected
    const workspace = await Workspace.findOne({ googleDriveRefreshToken: { $exists: true } });
    if (!workspace) {
        console.error("No workspace found with Google Drive connected. Please connect one in the UI first.");
        process.exit(1);
    }
    console.log(`Testing with Workspace: ${workspace.name} (${workspace._id})`);

    // 2. Create a dummy recording session
    const session = await RecordingSession.create({
        board: new mongoose.Types.ObjectId(), // dummy
        workspace: workspace._id,
        createdBy: workspace.owner,
        title: "Test Recording",
        startedAt: new Date(),
    });
    console.log(`Created dummy session: ${session._id}`);

    // 3. Dummy audio buffer (tiny .webm header)
    const dummyAudio = Buffer.from("ebml..."); 
    
    // 4. Upload to Drive
    const drive = getDriveClient(workspace.googleDriveRefreshToken);
    const fileMetadata = {
      name: `test-audio-${Date.now()}.webm`,
      parents: [workspace.googleDriveFolderId],
    };

    const media = {
      mimeType: "audio/webm",
      body: bufferToStream(dummyAudio),
    };

    console.log("Uploading to Google Drive...");
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name",
    });

    console.log("SUCCESS!");
    console.log(`Drive File ID: ${response.data.id}`);
    
    // Clean up
    await RecordingSession.findByIdAndDelete(session._id);
    await mongoose.disconnect();
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exit(1);
  }
}

runTest();
