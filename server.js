require("dotenv").config();

// Fix: Node.js DNS can't resolve MongoDB SRV via home router — use Google DNS
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const Message = require("./models/Message");
const route = require('./routes/auth')
const app = express();
const server = http.createServer(app);
const io = new Server(server);

console.log(process.env.MONGO_URI);

app.use(express.json());
app.use(express.static("public"));
app.use("/auth",route);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected ✅");
    })
    .catch((err) => {
        console.log("MongoDB Connection Error ❌");
        console.log(err);
    });

// Socket
let onlineUsers = {};

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // JOIN USER
    socket.on("join", (username) => {
        onlineUsers[socket.id] = username;
        io.emit("online users", Object.values(onlineUsers));
    });

    // CHAT MESSAGE
    socket.on("chat message", async (data) => {
        const time = new Date().toLocaleTimeString();

        try {
            const newMsg = new Message({
                user: data.user,
                message: data.message,
                time
            });
            await newMsg.save();
        } catch (err) {
            console.error("Failed to save message to DB:", err.message);
        }

        io.emit("chat message", {
            user: data.user,
            message: data.message,
            time
        });
    });

    // TYPING
    socket.on("typing", (username) => {
        socket.broadcast.emit("typing", username);
    });

    socket.on("stop typing", () => {
        socket.broadcast.emit("stop typing");
    });

    // DISCONNECT
    socket.on("disconnect", () => {
        delete onlineUsers[socket.id];
        io.emit("online users", Object.values(onlineUsers));
        console.log("User disconnected:", socket.id);
    });
});
app.get("/messages", async (req, res) => {
    try {
        const msgs = await Message.find();
        res.json(msgs);
    } catch (err) {
        console.error("Failed to load messages:", err.message);
        res.json([]);
    }
});

server.listen(3000, () => console.log("Server running"));