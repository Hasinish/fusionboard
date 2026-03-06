import * as dbModule from "../config/db.js";

export const connectDB = () => {
    const connect =
        typeof dbModule.default === "function"
            ? dbModule.default
            : typeof dbModule.connectDB === "function"
                ? dbModule.connectDB
                : null;

    if (!connect) {
        throw new Error("DB connect function not found.");
    }
    connect();
};
