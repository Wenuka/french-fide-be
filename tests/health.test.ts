import request from "supertest";
import express from "express";
import healthRouter from "../src/routes/health";

describe("Health check route", () => {
    test("GET /health returns 200 OK", async () => {
        const app = express();
        app.use("/health", healthRouter);

        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });
});
