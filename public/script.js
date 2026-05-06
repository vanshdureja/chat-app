const socket = io();

let username = localStorage.getItem("username");
if (!username) {
    username = prompt("Enter your name");
    localStorage.setItem("username", username);
}

socket.emit("join", username);

// ============ DOM References ============
const form            = document.getElementById("form");
const input           = document.getElementById("input");
const chat            = document.getElementById("chat");
const typingDiv       = document.getElementById("typing");
const onlineUsersDiv  = document.getElementById("onlineUsers");

const emojiBtn        = document.getElementById("emojiBtn");
const emojiPicker     = document.getElementById("emojiPicker");
const emojiGrid       = document.getElementById("emojiGrid");

const attachBtn       = document.getElementById("attachBtn");
const attachMenu      = document.getElementById("attachMenu");
const imageBtn        = document.getElementById("imageBtn");
const fileBtn         = document.getElementById("fileBtn");
const imageInput      = document.getElementById("imageInput");
const fileInput       = document.getElementById("fileInput");

const contactsBtn     = document.getElementById("contactsBtn");
const contactsPanel   = document.getElementById("contactsPanel");
const contactsList    = document.getElementById("contactsList");
const closeContacts   = document.getElementById("closeContacts");

const voiceCallBtn    = document.getElementById("voiceCallBtn");
const videoCallBtn    = document.getElementById("videoCallBtn");

const incomingCallModal = document.getElementById("incomingCallModal");
const callerNameEl    = document.getElementById("callerName");
const callTypeLabelEl = document.getElementById("callTypeLabel");
const acceptCallBtn   = document.getElementById("acceptCallBtn");
const rejectCallBtn   = document.getElementById("rejectCallBtn");

const activeCallUI    = document.getElementById("activeCallUI");
const callPeerNameEl  = document.getElementById("callPeerName");
const callStatusEl    = document.getElementById("callStatus");
const muteBtn         = document.getElementById("muteBtn");
const endCallBtn      = document.getElementById("endCallBtn");
const camBtn          = document.getElementById("camBtn");
const localVideoEl    = document.getElementById("localVideoEl");
const remoteVideoEl   = document.getElementById("remoteVideoEl");
const remoteAudioEl   = document.getElementById("remoteAudio");
const videosContainer = document.getElementById("videosContainer");

// ============ State ============
let onlineUsersList  = [];
let peerConnection   = null;
let localStream      = null;
let currentCallPeer  = null;
let currentCallType  = null;
let incomingCallData = null;
let isMuted          = false;
let isCamOff         = false;

// ICE candidate queue — candidates can arrive before setRemoteDescription completes
let pendingCandidates = [];
let remoteDescSet     = false;

const ICE_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

// ============ Emoji Picker ============
const EMOJIS = [
    "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍",
    "🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔",
    "🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴",
    "😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","😵","🤯","🤠","🥳","😎","🤓","🧐",
    "😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢",
    "😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿",
    "💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","❤️","🧡","💛","💚","💙",
    "💜","🖤","🤍","🤎","💔","💯","✨","🔥","🎉","🎊","🎈","🎁","🎂","🍕","🍔",
    "🍟","🌮","🍦","🍩","☕","🍺","🥂","👋","🤚","✋","👌","✌️","🤞","👍","👎",
    "👏","🙌","🤝","🙏","💪","🦾","👀","💬","💭","🗨️","🌍","🌈","⭐","🌙","☀️"
];

EMOJIS.forEach(emoji => {
    const span = document.createElement("span");
    span.textContent = emoji;
    span.addEventListener("click", () => {
        input.value += emoji;
        input.focus();
    });
    emojiGrid.appendChild(span);
});

emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle("hidden");
    attachMenu.classList.add("hidden");
});

attachBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    attachMenu.classList.toggle("hidden");
    emojiPicker.classList.add("hidden");
});

document.addEventListener("click", (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.classList.add("hidden");
    }
    if (!attachMenu.contains(e.target) && e.target !== attachBtn) {
        attachMenu.classList.add("hidden");
    }
});

emojiPicker.addEventListener("click", e => e.stopPropagation());
attachMenu.addEventListener("click", e => e.stopPropagation());

// ============ File / Image Attach ============
imageBtn.addEventListener("click", () => {
    imageInput.click();
    attachMenu.classList.add("hidden");
});

fileBtn.addEventListener("click", () => {
    fileInput.click();
    attachMenu.classList.add("hidden");
});

imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image too large. Max 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = e => {
        socket.emit("chat message", { user: username, message: e.target.result, type: "image", fileName: file.name });
    };
    reader.readAsDataURL(file);
    imageInput.value = "";
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("File too large. Max 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = e => {
        socket.emit("chat message", { user: username, message: e.target.result, type: "file", fileName: file.name });
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
});

// ============ Send Text Message ============
form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    socket.emit("chat message", { user: username, message: input.value, type: "text" });
    socket.emit("stop typing");
    input.value = "";
});

input.addEventListener("input", () => {
    socket.emit("typing", username);
    setTimeout(() => socket.emit("stop typing"), 1000);
});

// ============ Render Message ============
function renderMessage(data) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", data.user === username ? "sent" : "received");

    const nameEl = document.createElement("strong");
    nameEl.textContent = data.user;
    msgDiv.appendChild(nameEl);

    const type = data.type || "text";

    if (type === "image") {
        const img = document.createElement("img");
        img.src = data.message;
        img.alt = data.fileName || "image";
        img.className = "msg-image";
        img.addEventListener("click", () => window.open(data.message, "_blank"));
        msgDiv.appendChild(img);
    } else if (type === "file") {
        const link = document.createElement("a");
        link.href = data.message;
        link.download = data.fileName || "file";
        link.className = "file-link";
        link.textContent = "📄 " + (data.fileName || "Download");
        msgDiv.appendChild(link);
    } else {
        const textEl = document.createElement("span");
        textEl.textContent = data.message;
        msgDiv.appendChild(textEl);
    }

    const timeEl = document.createElement("div");
    timeEl.className = "time";
    timeEl.textContent = data.time;
    msgDiv.appendChild(timeEl);

    chat.appendChild(msgDiv);
    chat.scrollTop = chat.scrollHeight;
}

socket.on("chat message", renderMessage);

socket.on("typing", (user) => { typingDiv.textContent = `${user} is typing...`; });
socket.on("stop typing", () => { typingDiv.textContent = ""; });

// ============ Online Users / Contacts ============
socket.on("online users", (users) => {
    onlineUsersList = users;
    onlineUsersDiv.textContent = users.length + " online";

    contactsList.innerHTML = "";
    const others = users.filter(u => u !== username);

    if (others.length === 0) {
        const p = document.createElement("p");
        p.className = "no-contacts";
        p.textContent = "No one else online";
        contactsList.appendChild(p);
        return;
    }

    others.forEach(u => {
        const item = document.createElement("div");
        item.className = "contact-item";

        const avatar = document.createElement("div");
        avatar.className = "contact-avatar";
        avatar.textContent = "👤";

        const info = document.createElement("div");
        info.className = "contact-info";
        const name = document.createElement("strong");
        name.textContent = u;
        const dot = document.createElement("span");
        dot.className = "online-dot";
        dot.textContent = "● Online";
        info.appendChild(name);
        info.appendChild(dot);

        const btns = document.createElement("div");
        btns.className = "contact-call-btns";

        const vcBtn = document.createElement("button");
        vcBtn.textContent = "📞";
        vcBtn.title = "Voice Call";
        vcBtn.addEventListener("click", () => { contactsPanel.classList.add("hidden"); startCall(u, "voice"); });

        const vidBtn = document.createElement("button");
        vidBtn.textContent = "📹";
        vidBtn.title = "Video Call";
        vidBtn.addEventListener("click", () => { contactsPanel.classList.add("hidden"); startCall(u, "video"); });

        btns.appendChild(vcBtn);
        btns.appendChild(vidBtn);
        item.appendChild(avatar);
        item.appendChild(info);
        item.appendChild(btns);
        contactsList.appendChild(item);
    });
});

contactsBtn.addEventListener("click", () => contactsPanel.classList.toggle("hidden"));
closeContacts.addEventListener("click", () => contactsPanel.classList.add("hidden"));

voiceCallBtn.addEventListener("click", () => {
    if (onlineUsersList.filter(u => u !== username).length === 0) {
        alert("No other users online to call.");
        return;
    }
    contactsPanel.classList.remove("hidden");
});

videoCallBtn.addEventListener("click", () => {
    if (onlineUsersList.filter(u => u !== username).length === 0) {
        alert("No other users online to call.");
        return;
    }
    contactsPanel.classList.remove("hidden");
});

// ============ Load History ============
fetch("/messages")
    .then(res => res.json())
    .then(msgs => { msgs.forEach(renderMessage); chat.scrollTop = chat.scrollHeight; })
    .catch(err => console.error("Could not load history:", err));

// ============ WebRTC Helpers ============

// Set remote description then flush any ICE candidates that arrived early
async function applyRemoteDesc(desc) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    remoteDescSet = true;
    for (const c of pendingCandidates) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)); }
        catch (e) { console.warn("Flushed ICE error:", e); }
    }
    pendingCandidates = [];
}

function createPeerConnection() {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    // Route incoming media to the right element
    pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (currentCallType === "video") {
            // Video call: video element handles both audio+video
            remoteVideoEl.srcObject = stream;
            remoteVideoEl.play().catch(() => {});
        } else {
            // Voice call: dedicated audio element (never hidden, always plays)
            remoteAudioEl.srcObject = stream;
            remoteAudioEl.play().catch(() => {});
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", { to: currentCallPeer, candidate: event.candidate });
        }
    };

    pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log("ICE:", s);
        if (s === "connected" || s === "completed") callStatusEl.textContent = "Connected ✅";
        if (s === "failed") {
            callStatusEl.textContent = "Connection failed ❌";
            setTimeout(cleanupCall, 2000);
        }
    };

    pc.onconnectionstatechange = () => {
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
            cleanupCall();
        }
    };

    return pc;
}

// Returns { stream, type } — type may be downgraded from "video" to "voice" if camera fails
async function acquireMedia(requestedType) {
    const audioOpts = { echoCancellation: true, noiseSuppression: true };

    if (requestedType !== "video") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioOpts, video: false });
        return { stream, type: "voice" };
    }

    // Try video first
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioOpts, video: true });
        return { stream, type: "video" };
    } catch (videoErr) {
        console.warn("Camera error:", videoErr.name, videoErr.message);

        // Camera busy / not found / driver issue — offer voice-only fallback
        const cameraErrors = ["NotReadableError", "NotFoundError", "AbortError",
                              "NotAllowedError", "OverconstrainedError", "TypeError"];
        const isCameraIssue = cameraErrors.includes(videoErr.name)
            || videoErr.message.toLowerCase().includes("video")
            || videoErr.message.toLowerCase().includes("camera");

        if (isCameraIssue) {
            const ok = confirm(
                "Camera unavailable: " + videoErr.message +
                "\n\nContinue as a voice-only call instead?"
            );
            if (ok) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: audioOpts, video: false });
                return { stream, type: "voice" };
            }
        }
        throw videoErr; // re-throw if user declined or unrelated error
    }
}

function showActiveCallUI(peer, type) {
    callPeerNameEl.textContent = peer;
    callStatusEl.textContent = "Ringing...";
    activeCallUI.classList.remove("hidden");

    if (type === "video") {
        videosContainer.classList.remove("voice-mode");
        localVideoEl.style.display = "block";
    } else {
        videosContainer.classList.add("voice-mode");
        localVideoEl.style.display = "none";
    }
    camBtn.style.display = type === "video" ? "flex" : "none";
}

function cleanupCall() {
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    localVideoEl.srcObject = null;
    remoteVideoEl.srcObject = null;
    remoteAudioEl.srcObject = null;
    pendingCandidates = [];
    remoteDescSet = false;
    activeCallUI.classList.add("hidden");
    currentCallPeer = null;
    currentCallType = null;
    isMuted = false;
    isCamOff = false;
    muteBtn.textContent = "🎤";
    muteBtn.classList.remove("active");
    camBtn.textContent = "📹";
    camBtn.classList.remove("active");
}

// ============ Initiate Call ============
async function startCall(peer, type) {
    if (peerConnection) { alert("Already in a call."); return; }

    currentCallPeer = peer;
    pendingCandidates = [];
    remoteDescSet = false;

    let media;
    try {
        media = await acquireMedia(type);
    } catch (err) {
        alert("Cannot access microphone: " + err.message);
        currentCallPeer = null;
        return;
    }

    // type may have been downgraded to "voice" if camera failed
    currentCallType = media.type;
    localStream = media.stream;

    localVideoEl.srcObject = localStream;
    if (currentCallType === "video") localVideoEl.play().catch(() => {});

    peerConnection = createPeerConnection();
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send actual (possibly downgraded) callType so callee shows the right UI
    socket.emit("call-offer", { to: peer, from: username, offer, callType: currentCallType });
    showActiveCallUI(peer, currentCallType);
}

// ============ Incoming Call ============
socket.on("call-offer", ({ from, offer, callType }) => {
    if (peerConnection) { socket.emit("call-rejected", { to: from }); return; }
    incomingCallData = { from, offer, callType };
    callerNameEl.textContent = from;
    callTypeLabelEl.textContent = callType === "video" ? "📹 Video Call" : "📞 Voice Call";
    incomingCallModal.classList.remove("hidden");
});

acceptCallBtn.addEventListener("click", async () => {
    if (!incomingCallData) return;
    const { from, offer, callType } = incomingCallData;
    incomingCallModal.classList.add("hidden");
    incomingCallData = null;

    currentCallPeer = from;
    pendingCandidates = [];
    remoteDescSet = false;

    let media;
    try {
        media = await acquireMedia(callType);
    } catch (err) {
        alert("Cannot access microphone: " + err.message);
        socket.emit("call-rejected", { to: from });
        currentCallPeer = null;
        return;
    }

    // type may have been downgraded to "voice" if camera failed
    currentCallType = media.type;
    localStream = media.stream;

    localVideoEl.srcObject = localStream;
    if (currentCallType === "video") localVideoEl.play().catch(() => {});

    peerConnection = createPeerConnection();
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    // applyRemoteDesc flushes any queued ICE candidates automatically
    await applyRemoteDesc(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("call-answer", { to: from, answer });
    showActiveCallUI(from, currentCallType);
    callStatusEl.textContent = "Connecting...";
});

rejectCallBtn.addEventListener("click", () => {
    if (incomingCallData) {
        socket.emit("call-rejected", { to: incomingCallData.from });
        incomingCallData = null;
    }
    incomingCallModal.classList.add("hidden");
});

socket.on("call-answer", async ({ answer }) => {
    if (!peerConnection) return;
    // applyRemoteDesc flushes any ICE candidates that arrived before this answer
    await applyRemoteDesc(answer);
    callStatusEl.textContent = "Connecting...";
});

// ICE candidates: queue them if remote description isn't set yet
socket.on("ice-candidate", async ({ candidate }) => {
    if (!candidate) return;
    if (peerConnection && remoteDescSet) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn("ICE add error:", e); }
    } else {
        pendingCandidates.push(candidate);
    }
});

socket.on("call-rejected", () => {
    callStatusEl.textContent = "Call declined ❌";
    setTimeout(cleanupCall, 2000);
});

socket.on("call-ended", cleanupCall);

// ============ Call Controls ============
endCallBtn.addEventListener("click", () => {
    if (currentCallPeer) socket.emit("call-ended", { to: currentCallPeer });
    cleanupCall();
});

muteBtn.addEventListener("click", () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    isMuted = !isMuted;
    track.enabled = !isMuted;
    muteBtn.textContent = isMuted ? "🔇" : "🎤";
    muteBtn.classList.toggle("active", isMuted);
});

camBtn.addEventListener("click", () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    isCamOff = !isCamOff;
    track.enabled = !isCamOff;
    camBtn.textContent = isCamOff ? "🚫" : "📹";
    camBtn.classList.toggle("active", isCamOff);
});
