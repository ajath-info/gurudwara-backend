import express from 'express';
import { verifyToken } from '../../../middleware/auth.js';
import { multerMiddleware } from '../../../middleware/multer.js';
import { sendOtp } from "../../../controllers/api/v1/index.js";
import { verifyOtp } from '../../../controllers/api/v1/index.js';
import { getAllGurudwaras } from '../../../controllers/api/v1/index.js';
import * as MOBILEAPI from '../../../controllers/api/v1/index.js';  
import multer from 'multer';





const apiRouter = express.Router();



apiRouter.post('/sendOtp', multerMiddleware, sendOtp);
apiRouter.post('/verifyOtp', multerMiddleware, verifyOtp);
apiRouter.get('/getGurudwaras', verifyToken, getAllGurudwaras); 
apiRouter.post('/updateUserName', multerMiddleware, verifyToken, MOBILEAPI.updateUserName);
apiRouter.get('/rewardsHistory', verifyToken, MOBILEAPI.getRewardsHistory);
apiRouter.get('/getQuizzes', verifyToken, MOBILEAPI.getQuizzes);
apiRouter.post('/submitQuiz',multerMiddleware, verifyToken, MOBILEAPI.submitQuiz);




export default apiRouter;