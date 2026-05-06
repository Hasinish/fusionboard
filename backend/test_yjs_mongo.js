import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const collections = await mongoose.connection.db.listCollections().toArray();
  const names = collections.map(c => c.name);
  console.log("Collections in DB:", names);
  
  const hasYjs = names.includes("yjs-updates");
  if (hasYjs) {
    const count = await mongoose.connection.db.collection("yjs-updates").countDocuments();
    console.log(`yjs-updates collection EXISTS with ${count} document(s).`);
  } else {
    console.log("yjs-updates collection does NOT exist yet. It will be created when someone opens a board.");
    console.log("This is EXPECTED if no board has been opened since the restart.");
  }
  
  await mongoose.disconnect();
}

test();
