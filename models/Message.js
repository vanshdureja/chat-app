const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    user: String,
    message: String,
    time: String
});

module.exports = mongoose.model("Message", messageSchema);