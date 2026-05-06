const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    user: String,
    message: String,
    type: { type: String, default: "text" }, // text | image | file
    fileName: String,
    time: String
});

module.exports = mongoose.model("Message", messageSchema);
