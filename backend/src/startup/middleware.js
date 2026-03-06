import express from "express";
import cors from "cors";

export const setupMiddleware = (app, allowedOrigins) => {
    app.use(
        cors({
            origin: allowedOrigins,
            credentials: true,
        })
    );
    app.use(express.json());
};
