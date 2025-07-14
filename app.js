import express from "express";
import bodyParser from "body-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { connect_db } from "./utils/db.js";
import { createDbSchema } from "./utils/dbSchema.js";
import * as DOTENV from "./utils/dotenv.js";
import { apiResponseError } from "./middleware/error.js";
import ADMIN_ROUTER from "./routes/admin/index.js";
import apiRouter from "./routes/api/v1/index.js";

const app = express();

// Middlewares
app.use(helmet());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Too many requests, please try again later.",
  },
});
app.use(limiter);

app.use("/api/v1", apiRouter);
app.use("/admin", ADMIN_ROUTER);
app.use(apiResponseError);

(async () => {
  try {
    await connect_db();
    await createDbSchema();
    app.listen(DOTENV.PORT, "0.0.0.0", () =>
      console.log(`SERVER running on the Port ${DOTENV.PORT}`)
    );
  } catch (err) {
    console.error("Startup Error", err.message);
    process.exit(1);
  }
})();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection", err.message);
});
