import dotenv from 'dotenv';
dotenv.config({silent : true});

//PORT 
export const PORT = process.env.PORT || 3000; 

// NODE ENVIRONMENT 
export const NODE_ENV = process.env.NODE_ENV || 'development'; 

// DATATBASE
export const DB_HOST = process.env.DB_HOST;
export const DB_USER = process.env.DB_USER;
export const DB_PASS = process.env.DB_PASS;
export const DB_NAME = process.env.DB_NAME;
export const DB_PORT = process.env.DB_PORT;

// AUTHENTICATION
export const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

// SESSION SECRET 
export const SESSION_SECRET = process.env.SESSION_SECRET;

// ENCRYPTION SECRET
export const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
