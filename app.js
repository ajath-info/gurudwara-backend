import express from "express";
import bodyParser from "body-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import session from "express-session";
import { connect_db } from "./utils/db.js";
import { createDbSchema } from "./utils/dbSchema.js";
import * as DOTENV from "./utils/dotenv.js";
import { apiResponseError } from "./middleware/error.js";
import ADMIN_ROUTER from "./routes/admin/v1/index.js";
import apiRouter from "./routes/api/v1/index.js";
import { toastMiddleware } from "./middleware/toast.js";

import expressLayouts from "express-ejs-layouts";

const app = express();

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      },
    },
  })
);
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "root");
app.use(express.static("public"));
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.set("trust proxy", false);
app.use(
  session({
    secret: DOTENV.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: DOTENV.NODE_ENV === "production",
    },
  })
);

app.use(toastMiddleware);

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
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
