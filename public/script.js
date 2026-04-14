const socket = io();

let username = localStorage.getItem("username");

if (!username) {
    username = prompt("Enter your name");
    localStorage.setItem("username", username);
}

// JOIN EVENT
socket.emit("join", username);

const form = document.getElementById("form");
const input = document.getElementById("input");
const chat = document.getElementById("chat");
const typingDiv = document.getElementById("typing");
const onlineUsersDiv = document.getElementById("onlineUsers");

// SEND MESSAGE
form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (input.value) {
        socket.emit("chat message", {
            user: username,
            message: input.value
        });

        socket.emit("stop typing");

        input.value = "";
    }
});

// TYPING EVENT
input.addEventListener("input", () => {
    socket.emit("typing", username);

    setTimeout(() => {
        socket.emit("stop typing");
    }, 1000);
});

// RECEIVE MESSAGE
socket.on("chat message", (data) => {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message");

    if (data.user === username) {
        msgDiv.classList.add("sent");
    } else {
        msgDiv.classList.add("received");
    }

    msgDiv.innerHTML = `
        <strong>${data.user}</strong><br>
        ${data.message}
        <div class="time">${data.time}</div>
    `;

    chat.appendChild(msgDiv);
    chat.scrollTop = chat.scrollHeight;
});

// SHOW TYPING
socket.on("typing", (user) => {
    typingDiv.textContent = `${user} is typing...`;
});

socket.on("stop typing", () => {
    typingDiv.textContent = "";
});

// ONLINE USERS
socket.on("online users", (users) => {
    onlineUsersDiv.textContent = "Online: " + users.join(", ");
});

// LOAD MESSAGE HISTORY
fetch("/messages")
    .then(res => res.json())
    .then(msgs => {
        msgs.forEach(data => {
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");
            msgDiv.classList.add(data.user === username ? "sent" : "received");
            msgDiv.innerHTML = `
                <strong>${data.user}</strong><br>
                ${data.message}
                <div class="time">${data.time}</div>
            `;
            chat.appendChild(msgDiv);
        });
        chat.scrollTop = chat.scrollHeight;
    })
    .catch(err => console.error("Could not load message history:", err));