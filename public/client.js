// client.js - all frontend logic for the chat app
const socket = io();

// ---------- DOM elements ----------
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const roomSelect = document.getElementById('room-select');
const loginError = document.getElementById('login-error');

const chatScreen = document.getElementById('chat-screen');
const roomTitle = document.getElementById('room-title');
const roomTabs = document.getElementById('room-tabs');
const messagesEl = document.getElementById('messages');
const userListEl = document.getElementById('user-list');
const typingIndicator = document.getElementById('typing-indicator');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

// ---------- Client state ----------
let myUsername = null;   // saved after joining (used to style our own messages)
let currentRoom = null;
const typingUsers = new Set();
let typingTimer = null;

// ---------- 1) LOGIN: emit + wait for the acknowledgement ----------
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const room = roomSelect.value;
  if (!username) return;

  loginError.textContent = '';

  // 3rd argument = ack callback the server will call back
  socket.emit('user:join', { username: username, room: room }, (res) => {
    if (!res.ok) {
      loginError.textContent = res.error; // rejected: STAY on the login screen
      return;
    }
    myUsername = username;
    currentRoom = room;
    showChatScreen();
  });
});

function showChatScreen() {
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  roomTitle.textContent = '#' + currentRoom;
  for (const tab of roomTabs.querySelectorAll('button')) {
    tab.classList.toggle('active', tab.dataset.room === currentRoom);
  }
  messageInput.focus();
}

// ---------- 2) SENDING MESSAGES ----------
messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('chat:message', text);
  messageInput.value = '';
  socket.emit('typing:stop');
  messageInput.focus();
});

// ---------- 3) TYPING INDICATOR: on every keystroke, stop after 1.5s of silence ----------
messageInput.addEventListener('input', () => {
  socket.emit('typing:start');
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('typing:stop'), 1500);
});

// ---------- 4) ROOM SWITCHING (no page reload) ----------
roomTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-room]');
  if (!button) return;
  const room = button.dataset.room;
  if (room === currentRoom) return;

  socket.emit('room:change', { room: room }, (res) => {
    if (!res.ok) return;
    currentRoom = res.room;
    roomTitle.textContent = '#' + currentRoom;
    for (const tab of roomTabs.querySelectorAll('button')) {
      tab.classList.toggle('active', tab.dataset.room === currentRoom);
    }
    typingUsers.clear();
    renderTyping();
    // #messages is cleared when chat:history arrives (listener below)
    messageInput.focus();
  });
});

// ---------- RENDERING: textContent only, never innerHTML for user data ----------
function appendMessage(msg) {
  const row = document.createElement('div');
  row.className = 'message' + (msg.username === myUsername ? ' own' : '');

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = msg.username + ' · ' + msg.time; // sender + timestamp

  const body = document.createElement('span');
  body.className = 'text';
  body.textContent = msg.text;

  row.appendChild(meta);
  row.appendChild(body);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function appendSystemMessage(sys) {
  const row = document.createElement('div');
  row.className = 'system';
  row.textContent = sys.text + ' · ' + sys.time;
  messagesEl.appendChild(row);
  scrollToBottom();
}

function renderUserList(names) {
  userListEl.innerHTML = ''; // clear first: this list is a full replacement
  for (const name of names) {
    const li = document.createElement('li');
    li.textContent = name;
    if (name === myUsername) li.classList.add('me');
    userListEl.appendChild(li);
  }
}

function renderTyping() {
  const others = [...typingUsers].filter((name) => name !== myUsername);
  if (others.length === 0) {
    typingIndicator.textContent = '';
  } else if (others.length === 1) {
    typingIndicator.textContent = others[0] + ' is typing...';
  } else {
    typingIndicator.textContent = others.join(', ') + ' are typing...';
  }
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight; // keep newest messages visible
}

// ---------- 5) SOCKET LISTENERS (server -> client) ----------
socket.on('chat:message', (msg) => appendMessage(msg));

// History arrives right after join/switch: clear FIRST, then render,
// so old room messages never stack on top of the new room's.
socket.on('chat:history', (msgs) => {
  messagesEl.innerHTML = '';
  for (const msg of msgs) appendMessage(msg);
});

socket.on('system', (sys) => appendSystemMessage(sys));
socket.on('user:list', (names) => renderUserList(names));

socket.on('typing:start', (username) => {
  typingUsers.add(username);
  renderTyping();
});

socket.on('typing:stop', (username) => {
  typingUsers.delete(username);
  renderTyping();
});
