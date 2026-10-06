# Workshop Live Poll

A real-time polling app for workshops and presentations. Presenters can display a question and live results on a large screen while participants vote from their phones using a QR code. The interface includes English, Tamil, and Sinhala text.

## Features

- Presenter board with live vote counts and results
- Phone-friendly voting page and QR-code join link
- Presenter controls for questions, answers, voting, and resetting counts
- Participant questions and live reactions
- English, Tamil, and Sinhala question display

## Requirements

- Node.js
- An Ably app and a **restricted** Ably API key configured for the app's channel. Do not put an Ably root key in browser code.

## Setup

1. In `Live poll/common.js`, replace `PASTE_RESTRICTED_ABLY_KEY_HERE` with your restricted Ably key. This demo connects from the browser, so the key is visible to participants; use a key with only the required permissions and restrictions.
2. From the repository root, start the server:

   ```sh
   npm start
   ```

3. Open the presenter board at `http://localhost:3000/board.html`.
4. Participants on the same Wi-Fi network can scan the board's QR code or open the phone voting URL shown by the server.

The server may select the next available port if port 3000 is already in use.
