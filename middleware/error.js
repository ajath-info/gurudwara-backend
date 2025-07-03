import { apiResponse } from "../utils/helper.js";

/**
 * 
 */
export const apiResponseError = (err, req, res, next) => {
    return apiResponse(res, {
        error : true,
        code : 500, 
        status : 0,
        message : err.message,
        payload : {}
    })
}