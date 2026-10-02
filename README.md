# Supervisor Assistant

An interactive command-line assistant built with LangChain agents and Google Gemini. It routes requests to specialized agents for calendar scheduling, email, and contact lookup.

## Requirements

- Node.js and npm
- A Google AI API key for Gemini
- A Google Cloud project with the APIs listed below enabled
- Google OAuth client credentials for Contacts and Calendar access

## Google Cloud Setup

In the Google Cloud project used for OAuth, enable:

- **Google People API** for searching Google Contacts
- **Google Calendar API** for creating calendar events
- **Gmail API** if email sending is connected to Gmail. The current email tool is a stub and does not call Gmail, but the OAuth server requests the Gmail send scope.

Configure the OAuth consent screen and add your account as a test user if the app is in testing. Create an OAuth client ID for a web application and add `http://localhost:3600/callback` as an authorized redirect URI.

## Setup

Install dependencies:

```sh
npm install
```

Create a `.env` file in the project root with your credentials:

```dotenv
GOOGLE_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_oauth_client_id
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3600/callback
GOOGLE_ACCESS_TOKEN=your_google_access_token
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
```

To authorize Google APIs, start the OAuth server:

```sh
npx tsx server.ts
```

Open `http://localhost:3600/auth` in a browser and approve access. The callback prints the returned tokens in the server terminal. Add the access and refresh tokens to `.env`, then restart the assistant. Keep `.env` private and do not commit it.

## Run

```sh
npx tsx index.ts
```

Enter a request at the prompt. Type `exit` to quit. The supervisor keeps conversation state for the current thread while the process is running.

## Example Requests

- `Find Chetan's email address.`
- `Send an email to Chetan reminding him to review the new mockups.`
- `Create a one-hour meeting with ABC next Tuesday at 2 PM.`
- `Schedule a project check-in with Chetan tomorrow at 10 AM.`

Use the person's name as it appears in Contacts. For meeting requests, include a date, time, duration, and attendee when possible.

## Current Limitations

- Contact lookup searches Google Contacts through the Google People API.
- Calendar event creation uses Google Calendar, but availability checks return fixed sample times and do not query real calendars.
