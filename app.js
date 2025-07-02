import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import {connect_db} from './utils/db.js';
import { createDbSchema } from './utils/dbSchema.js';



const app = express();





// Middlewares
app.use(helmet());
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


// Rate limiting configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      error: 'Too many requests, please try again later.',
    },
  });
app.use(limiter);
  
// Connect to MySql database
await connect_db();

// Create database schema
await createDbSchema(); 


// Start Server 
app.listen(3000, ()=>{
    console.log('App is running')
})
