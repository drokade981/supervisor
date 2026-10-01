# Supervisor Assistant

An interactive command-line assistant built with LangChain agents and Google Gemini. It routes requests to specialized agents for calendar scheduling, email, and contact lookup.

## Requirements

- Node.js with a TypeScript runner such as `tsx`
- A Google AI API key

## Setup

Install the dependencies:

```sh
npm install
```

Create a `.env` file in the project root:

```dotenv
GOOGLE_API_KEY=your_google_ai_api_key
```

## Run

```sh
npx tsx index.ts
```

Enter a request at the prompt. Type `exit` to quit. The supervisor keeps conversation state for the current thread while the process is running.

## Current limitations

The integrations are placeholders for development:

- Calendar availability returns fixed sample times, and event creation does not contact a calendar service.
- Email sending does not deliver email; it returns a confirmation string.
- Contact lookup uses hard-coded sample records and does not filter them by the search query.

Connect these tools to real services before relying on them for calendar updates, email delivery, or contact data.
