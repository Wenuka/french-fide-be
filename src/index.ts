import app from "./app";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT || 8080);

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
