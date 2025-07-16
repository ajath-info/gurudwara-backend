import express from "express";
import { verifyAdminToken, verifyToken } from "../../../middleware/auth.js";
import { multerMiddleware } from "../../../middleware/multer.js";
import { sendOtp } from "../../../controllers/api/v1/index.js";
import { verifyOtp } from "../../../controllers/api/v1/index.js";
import { getAllGurudwaras } from "../../../controllers/api/v1/index.js";
import * as MOBILEAPI from "../../../controllers/api/v1/index.js";
import multer, { MulterError } from "multer";

const apiRouter = express.Router();

apiRouter.post("/sendOtp", multerMiddleware, sendOtp);
apiRouter.post("/verifyOtp", multerMiddleware, verifyOtp);
apiRouter.get("/getGurudwaras", verifyToken, getAllGurudwaras);
apiRouter.get(
  "/gurudwaraDetails/:id",
  verifyToken,
  MOBILEAPI.getGurudwaraDetails
);
apiRouter.post(
  "/updateUserName",
  multerMiddleware,
  verifyToken,
  MOBILEAPI.updateUserName
);
apiRouter.get("/rewardsHistory", verifyToken, MOBILEAPI.getRewardsHistory);
apiRouter.get("/getQuizzes", verifyToken, MOBILEAPI.getQuizzes);
apiRouter.post(
  "/submitQuiz",
  multerMiddleware,
  verifyToken,
  MOBILEAPI.submitQuiz
);

apiRouter.post("/scanQr", verifyToken, multerMiddleware, MOBILEAPI.scanQrCode);
apiRouter.get(
  "/gurudwara/:id/generateQr",

  MOBILEAPI.generateQR
);
apiRouter.post(
  "/favouriteGurudwara/:id",
  verifyToken,
  multerMiddleware,
  MOBILEAPI.addFavouriteGurudwara
);

// Get Favourite Gurudwaras
apiRouter.get(
  "/getFavouriteGurudwara",
  verifyToken,
  MOBILEAPI.getFavouriteGurudwaras
);

// Search Gurudwaras
apiRouter.get(
  "/searchGurudwara",
  verifyToken,
  MOBILEAPI.advancedSearchGurudwaras
);

// Edit user
apiRouter.post(
  "/updateUser",
  multerMiddleware,
  verifyToken,
  MOBILEAPI.editProfile
);

// Points History
apiRouter.get("/pointsHistory", verifyToken, MOBILEAPI.getPointsHistory);

// Visit History
apiRouter.get("/visitHistory", verifyToken, MOBILEAPI.getVisitHistory);

// Redeem Rewards
apiRouter.post(
  "/redeemRewards",
  verifyToken,
  multerMiddleware,
  MOBILEAPI.redeemRewards
);
apiRouter.get("/logout", verifyToken, MOBILEAPI.logout);
export default apiRouter;
