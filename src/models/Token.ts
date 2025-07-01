import mongoose, { Schema } from "mongoose";

const tokenSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref:"User",
        unique:true,
        required:true
    },
    token:{
        required:true,
        type:String
    }

});

export default mongoose.model("Token",tokenSchema);