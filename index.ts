import { ChatOpenAI } from "@langchain/openai";
import { tool } from "langchain";
import { createAgent } from "langchain";
import { z } from "zod";
import dotenv from "dotenv";
import { ChatGoogle } from "@langchain/google";
import readline from "readline/promises";
import { MemorySaver } from "@langchain/langgraph";

dotenv.config();

const model2 = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-5-mini-",
});

const model = new ChatGoogle({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-3.5-flash-lite",
});

const createCalendarEvent = tool(
    async ({ title, startTime, endTime, attendees, location }) => {
        // Stub: In practice, this would call Google Calendar API, Outlook API, etc.
        return `Event created: ${title} from ${startTime} to ${endTime} with ${attendees.length} attendees`;
    },
    {
        name: "create_calendar_event",
        description: "Create a calendar event. Requires exact ISO datetime format.",
        schema: z.object({
            title: z.string(),
            startTime: z.string().describe("ISO format: '2024-01-15T14:00:00'"),
            endTime: z.string().describe("ISO format: '2024-01-15T15:00:00'"),
            attendees: z.array(z.string()).describe("email addresses"),
            location: z.string().optional(),
        }),
    }
);

const sendEmail = tool(
    async ({ to, subject, body, cc }) => {
        // Stub: In practice, this would call SendGrid, Gmail API, etc.
        return `Email sent to ${to.join(', ')} - Subject: ${subject}`;
    },
    {
        name: "send_email",
        description: "Send an email via email API. Requires properly formatted addresses.",
        schema: z.object({
            to: z.array(z.string()).describe("email addresses"),
            subject: z.string(),
            body: z.string(),
            cc: z.array(z.string()).optional(),
        }),
    }
);

const getAvailableTimeSlots = tool(
    async ({ attendees, date, durationMinutes }) => {
        // Stub: In practice, this would query calendar APIs
        return ["09:00", "14:00", "16:00"];
    },
    {
        name: "get_available_time_slots",
        description: "Check calendar availability for given attendees on a specific date.",
        schema: z.object({
            attendees: z.array(z.string()),
            date: z.string().describe("ISO format: '2024-01-15'"),
            durationMinutes: z.number(),
        }),
    }
);

const manageContacts = tool(
    async ({ request }) => {
        const result = await contactAgent.invoke({
            messages: [{ role: "user", content: request }]
        });
        const lastMessage = result.messages[result.messages.length - 1];
        return lastMessage.text;
    },
    {
        name: "manage_contacts",
        description: `Get contacts using natural language.
        use this when user wants toi get list of contacts or even single contact.
        Input: Natural language contact request (e.g., 'get me the list of contacts in design team')
        Output: List of contacts in JSON format`.trim(),
        schema: z.object({
            request: z.string().describe("Natural language request for contact list request"),
        }),
    }
);


const now = new Date();
const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
].join("-");

const CALENDAR_AGENT_PROMPT = `
Today's date is ${today}.
You are a calendar scheduling assistant.
Parse natural language scheduling requests (e.g., 'next Tuesday at 2pm')
into proper ISO datetime formats.
Use get_available_time_slots to check availability when needed.
If there is no suitable time slot, stop and confirm unavailability in your response.
Use create_calendar_event to schedule events.
Always confirm what was scheduled in your final response.
`.trim();

const calendarAgent = createAgent({
    model: model,
    tools: [createCalendarEvent, getAvailableTimeSlots],
    systemPrompt: CALENDAR_AGENT_PROMPT,
});

const EMAIL_AGENT_PROMPT = `
You are an email assistant.
Compose professional emails based on natural language requests.
Extract recipient information and craft appropriate subject lines and body text.
Use send_email to send the message.
Always confirm what was sent in your final response.
`.trim();

const emailAgent = createAgent({
    model: model,
    tools: [sendEmail],
    systemPrompt: EMAIL_AGENT_PROMPT,
});

const CONTACT_AGENT_PROMPT = `You are a contact assistant.
Find or create contact records as per requirements.
Use get_contacts to fetch contact list.`.trim();

const getContacts = tool(
    async ({ search }) => {
        return JSON.stringify([
            { id: 1, team: "Design", name: "John", email: "BpZ6s@example.com", phone: "123-456-7890" },
            { id: 2, team: "Development", name: "Jane Doe", email: "tGtZ5@example.com", phone: "987-654-3210" },
            { id: 3, team: "DevOps", name: "Bob Smith", email: "tGtZ5@example.com", phone: "987-654-3210" },
        ]);
    },
    {
        name: "get_contacts",
        description: "Get a list of contacts",
        schema: z.object({
            search: z.string().describe('Search query for the contact. e.g. design or John'),
        }),
    }
);

const contactAgent = createAgent({
    model,
    tools: [getContacts],
    systemPrompt: CONTACT_AGENT_PROMPT,
});

async function testEmailAgent() {
    const query = "Send the design team a reminder about reviewing the new mockups";

    const stream = await emailAgent.streamEvents(
        { messages: [{ role: "user", content: query }] },
        { version: "v3" }
    );

    await Promise.all([
        (async () => {
            for await (const message of stream.messages) {
                for await (const token of message.text) {
                    process.stdout.write(token);
                }
            }
        })(),
        (async () => {
            for await (const call of stream.toolCalls) {
                console.log(`\nTool call: ${call.name}(${JSON.stringify(call.input)})`);
                console.log(`Tool result: ${await call.output}`);
            }
        })(),
    ]);
}

async function testCalendarAgent() {
    const query = "Schedule a team meeting next Tuesday at 2pm for 1 hour";

    const stream = await calendarAgent.streamEvents(
        { messages: [{ role: "user", content: query }] },
        { version: "v3" }
    );

    await Promise.all([
        (async () => {
            for await (const message of stream.messages) {
                for await (const token of message.text) {
                    process.stdout.write(token);
                }
            }
        })(),
        (async () => {
            for await (const call of stream.toolCalls) {
                console.log(`\nTool call: ${call.name}(${JSON.stringify(call.input)})`);
                console.log(`Tool result: ${await call.output}`);
            }
        })(),
    ]);
}

const scheduleEvent = tool(
    async ({ request }) => {
        const result = await calendarAgent.invoke({
            messages: [{ role: "user", content: request }]
        });
        const lastMessage = result.messages[result.messages.length - 1];
        return lastMessage.text;
    },
    {
        name: "schedule_event",
        description: `
Schedule calendar events using natural language.

Use this when the user wants to create, modify, or check calendar appointments.
Handles date/time parsing, availability checking, and event creation.

Input: Natural language scheduling request (e.g., 'meeting with design team next Tuesday at 2pm')
    `.trim(),
        schema: z.object({
            request: z.string().describe("Natural language scheduling request"),
        }),
    }
);

const manageEmail = tool(
    async ({ request }) => {
        const result = await emailAgent.invoke({
            messages: [{ role: "user", content: request }]
        });
        const lastMessage = result.messages[result.messages.length - 1];
        return lastMessage.text;
    },
    {
        name: "manage_email",
        description: `
Send emails using natural language.

Use this when the user wants to send notifications, reminders, or any email communication.
Handles recipient extraction, subject generation, and email composition.

Input: Natural language email request (e.g., 'send them a reminder about the meeting')
    `.trim(),
        schema: z.object({
            request: z.string().describe("Natural language email request"),
        }),
    }
);

async function supervisorAgentTest(userInput:string, config:any) {
    // const query = userInput;

    const stream = await supervisorAgent.streamEvents(
        { messages: [{ role: "user", content: userInput }] },
        { ...config, version: "v3" },
    );

    await Promise.all([
        (async () => {
            for await (const message of stream.messages) {
                for await (const token of message.text) {
                    process.stdout.write(token);
                }
            }
        })(),
        (async () => {
            for await (const call of stream.toolCalls) {
                console.log(`\nTool call: ${call.name}(${JSON.stringify(call.input)})`);
                console.log(`Tool result: ${await call.output}`);
            }
        })(),
    ]);
}

const SUPERVISOR_PROMPT = `
You are a helpful personal assistant.
You can schedule calendar events and send emails.
To send an email/notification, you must first get the contact information using the manage_contacts tool to get email address.
You will get contact information from manage_contacts tool before sending email or scheduling an event.
Break down user requests into appropriate tool calls and coordinate the results.
When a request involves multiple actions, use multiple tools in sequence. Make sure to call the tools in correct order.
`.trim();

const supervisorAgent = createAgent({
    model: model,
    tools: [scheduleEvent, manageEmail, manageContacts],
    systemPrompt: SUPERVISOR_PROMPT,
    checkpointer: new MemorySaver(),
});

async function main() {
    const config = { configurable: {thread_id: '1'} };
    const rl= readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    while (true) {
        const userInput = await rl.question("Enter your query (or type 'exit' to quit): ");
        if (userInput.toLowerCase() === 'exit') {
            console.log("Exiting...");
            break;
        }
        await supervisorAgentTest(userInput, config);
    }
    // testEmailAgent();
    rl.close();
}

main();