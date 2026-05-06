const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// Signup
router.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({ username, password: hashed });
    await user.save();

    res.json({ message: "User created" });
});

// Login
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Wrong password" });

    const token = jwt.sign({ id: user._id }, "secretkey");

    res.json({ token, username });
});

module.exports = router;