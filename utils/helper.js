import jwt from 'jsonwebtoken';
import * as DOTENV from './dotenv.js'
import {format} from 'date-fns';


/**
 * 
 */

export const apiResponse = (res, {error = false, code = 200, status = 1, message, payload = {}} = {}) => {
    const responseBody = {error , code , status , message, payload};
    res.status(code).json(responseBody)
}

/** 
 * 
 */
export const generateToken = async(id) => { 
    try { 
        const payload = {id}
        const token = jwt.sign(payload, DOTENV.JWT_SECRET_KEY, {expiresIn : '30d'});
        return token;
    }catch(err){ 
        next(err);
    }
}

/**
 * 
 */
export const generateOTP = () => {
  // Generate a random 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000);
  return otp;
};

/**
 * 
*/  
export const formatDateTime = (dateValue) => {
  if (!dateValue || dateValue === "0000-00-00 00:00:00") {
    return null;
  }

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return null;
    }

    return format(date, "yyyy-MM-dd HH:mm:ss");
  } catch (error) {
    console.error("Date formatting error:", error);
    return null;
  }
};