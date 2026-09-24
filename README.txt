CHAT APP - FINAL PROJECT
========================
Name(s): <your name(s) here>

HOW TO RUN
----------
1. cd chat-app
2. npm install        (downloads express + socket.io; do this once)
3. node server.js
4. Open http://localhost:3000 in two or more browser tabs

FEATURES (core, 72 pts)
-----------------------
[x] Username entry + room join (chat UI appears on success)
[x] Real-time messaging across tabs in the same room
[x] Sender + timestamp on every message (rendered with textContent)
[x] System messages on join and leave
[x] 3 rooms (#general, #games, #music), switchable with no page reload
[x] Live per-room user list (updates on join, leave, and room switch)
[x] Message history: last 30 messages per room, shown to new joiners
[x] Username uniqueness: server rejects a taken name via ack; client shows
    the error and stays on the login screen so you can retry
[x] Typing indicator: "X is typing..." shown to others in the room

STRETCH GOALS
-------------
None implemented.

KNOWN ISSUES
------------
None known. If the port 3000 is already in use on your machine, either
close the other program or change PORT at the top of server.js.
