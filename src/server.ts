import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRouter from "./routes/admin";
import userRouter from "./routes/User";
dotenv.config();

const app = express();
//cross origin middleware 
app.use(cors({
    origin: ["http://localhost:5173","https://bnabfrontend.onrender.com"],
     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PORT = process.env.PORT;
const mongooseUrl = process.env.MONGO_URI;
//checking for mongoose url
if (!mongooseUrl) {
    throw new Error("MONGO_URI is not defined in your .env file")
}

// Connect to MongoDB and start server
mongoose.connect(mongooseUrl)
    .then(() => {
        console.log("Database connections successful")
    })
    .catch(err => console.log(`Database connection failed${err}`));

//router handlers
app.use('/api/admin',adminRouter);
app.use('/api/user',userRouter);

//listening port
app.listen(PORT, (err) => {
    if (err) {
        console.error("Error starting server:", err);
        process.exit(1);
    }
    console.log(`server running on port:${PORT}`)
})  