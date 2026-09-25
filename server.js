// server.js - Node.js + Socket.IO backend for the chat app
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Express serves the frontend files; Socket.IO rides the same HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;

// ---------- STATE (module scope: one shared copy for every connection) ----------
const rooms = ['general', 'games', 'music', 'coding']; // 4+ rooms
const users = new Map();   // socket.id -> { username, room }
const history = new Map(); // room -> [ msg, msg, ... ] capped at 30
const HISTORY_LIMIT = 30;

let messageCounter = 0;
function nextMessageId() {
  messageCounter += 1;
  return 'msg-' + Date.now() + '-' + messageCounter;
}

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Save a message into a room's history, keeping only the last 30
function remember(room, msg) {
  if (!history.has(room)) history.set(room, []);
  const list = history.get(room);
  list.push(msg);
  if (list.length > HISTORY_LIMIT) list.shift();
}

// All usernames currently in a room
function userList(room) {
  const names = [];
  for (const u of users.values()) {
    if (u.room === room) names.push(u.username);
  }
  return names;
}

function broadcastUserList(room) {
  io.to(room).emit('user:list', userList(room));
}

// Case-insensitive check: is this username already in use?
function nameTaken(username) {
  const lower = username.toLowerCase();
  for (const u of users.values()) {
    if (u.username.toLowerCase() === lower) return true;
  }
  return false;
}

// System messages (join/leave) go to the room but are NOT saved in history
function appendSystem(room, text) {
  io.to(room).emit('system', { text: text, time: now() });
}

// ---------- REAL-TIME LOGIC ----------
io.on('connection', (socket) => {
  console.log('connected:', socket.id);

  // 1) JOIN - client asks, server answers via the ack callback
  socket.on('user:join', (data, ack) => {
    const username = String((data && data.username) || '').trim();
    if (!username) return ack({ ok: false, error: 'Please enter a username.' });
    if (nameTaken(username)) return ack({ ok: false, error: 'That username is already taken.' });

    const room = rooms.includes(data.room) ? data.room : rooms[0];

    users.set(socket.id, { username: username, room: room });
    socket.join(room); // MUST come before any io.to(room).emit

    socket.emit('chat:history', history.get(room) || []); // catch the newcomer up
    broadcastUserList(room);
    appendSystem(room, username + ' joined the room');

    ack({ ok: true });
  });

  // 2) CHAT MESSAGE - validate, remember, broadcast to the whole room
  socket.on('chat:message', (text) => {
    const u = users.get(socket.id);
    if (!u) return; // always check the user exists before using it

    text = String(text || '').trim();
    if (!text) return;

    const msg = { id: nextMessageId(), username: u.username, text: text, time: now() };
    remember(u.room, msg);
    io.to(u.room).emit('chat:message', msg);
  });

  // 3) ROOM CHANGE - leave old, join new, re-scope lists + history
  socket.on('room:change', (data, ack) => {
    const u = users.get(socket.id);
    if (!u) return ack({ ok: false, error: 'Join a room first.' });

    const room = data && data.room;
    if (!rooms.includes(room)) return ack({ ok: false, error: 'Unknown room.' });
    if (u.room === room) return ack({ ok: true, room: room }); // no-op

    const oldRoom = u.room;

    socket.leave(oldRoom);
    u.room = room; // update the map BEFORE re-sending the lists
    socket.join(room);

    socket.emit('chat:history', history.get(room) || []);
    broadcastUserList(oldRoom);
    broadcastUserList(room);
    appendSystem(oldRoom, u.username + ' left the room');
    appendSystem(room, u.username + ' joined the room');

    ack({ ok: true, room: room });
  });

  // 4) TYPING INDICATOR - forward to everyone else in the room
  socket.on('typing:start', () => {
    const u = users.get(socket.id);
    if (!u) return;
    socket.to(u.room).emit('typing:start', u.username);
  });

  socket.on('typing:stop', () => {
    const u = users.get(socket.id);
    if (!u) return;
    socket.to(u.room).emit('typing:stop', u.username);
  });

  // 5) DISCONNECT - drop from the map, refresh that room, announce
  socket.on('disconnect', () => {
    const u = users.get(socket.id);
    if (!u) return;
    users.delete(socket.id);
    broadcastUserList(u.room);
    appendSystem(u.room, u.username + ' left the room');
    console.log('disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log('Chat app running at http://localhost:' + PORT);
});
