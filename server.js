require("dotenv").config();

// Fix: Node.js DNS can't resolve MongoDB SRV via home router — use Google DNS
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const Message = require("./models/Message");
const route = require('./routes/auth');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));
app.use("/auth", route);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected ✅"))
    .catch((err) => {
        console.log("MongoDB Connection Error ❌");
        console.log(err);
    });

// username -> socketId map (for call routing)
let onlineUsers = {};    // socketId -> username
let userSocketMap = {};  // username -> socketId

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", (username) => {
        onlineUsers[socket.id] = username;
        userSocketMap[username] = socket.id;
        io.emit("online users", Object.values(onlineUsers));
    });

    socket.on("chat message", async (data) => {
        const time = new Date().toLocaleTimeString();
        const msgType = data.type || "text";

        try {
            const newMsg = new Message({
                user: data.user,
                message: data.message,
                type: msgType,
                fileName: data.fileName || null,
                time
            });
            await newMsg.save();
        } catch (err) {
            console.error("Failed to save message:", err.message);
        }

        io.emit("chat message", {
            user: data.user,
            message: data.message,
            type: msgType,
            fileName: data.fileName || null,
            time
        });
    });

    socket.on("typing", (username) => {
        socket.broadcast.emit("typing", username);
    });

    socket.on("stop typing", () => {
        socket.broadcast.emit("stop typing");
    });

    // ======= WebRTC Signaling =======
    socket.on("call-offer", ({ to, from, offer, callType }) => {
        const targetId = userSocketMap[to];
        if (targetId) {
            io.to(targetId).emit("call-offer", { from, offer, callType });
        }
    });

    socket.on("call-answer", ({ to, answer }) => {
        const targetId = userSocketMap[to];
        if (targetId) {
            io.to(targetId).emit("call-answer", { answer });
        }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
        const targetId = userSocketMap[to];
        if (targetId) {
            io.to(targetId).emit("ice-candidate", { candidate });
        }
    });

    socket.on("call-rejected", ({ to }) => {
        const targetId = userSocketMap[to];
        if (targetId) io.to(targetId).emit("call-rejected");
    });

    socket.on("call-ended", ({ to }) => {
        const targetId = userSocketMap[to];
        if (targetId) io.to(targetId).emit("call-ended");
    });

    socket.on("disconnect", () => {
        const username = onlineUsers[socket.id];
        delete onlineUsers[socket.id];
        if (username) delete userSocketMap[username];
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

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
