import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from 'swagger-ui-express';
import indexRouter from "./routes";
import healthRouter from "./routes/health";
import eventsRouter from "./routes/user";
import swaggerSpec from "./config/swagger";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000", "https://fideprep.ch", "https://test.fideprep.ch"],
    credentials: true,
  })
);

// API Documentation
app.use('/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'French FIDE API Documentation',
  })
);

// API Routes
app.use('/', indexRouter);
app.use('/health', healthRouter);
app.use('/api/events', eventsRouter);

export default app;
