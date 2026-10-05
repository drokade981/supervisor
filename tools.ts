import { tool } from "@langchain/core/tools";
import z from "zod";
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { google } from "googleapis";
import dotenv from "dotenv";
import { model } from "./model.ts";
dotenv.config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
);

oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const people = google.people({ version: "v1", auth: oauth2Client });
const gmail = google.gmail({version: "v1", auth: oauth2Client});


type EventData = z.infer<typeof createEventSchema>;

const createEventSchema = z.object({
    summary: z.string().describe('The title of the event'),
    start: z.object({
        dateTime: z.string().describe('The date time of start of the event.'),
        timeZone: z.string().describe('Current IANA timezone string.'),
    }),
    end: z.object({
        dateTime: z.string().describe('The date time of end of the event.'),
        timeZone: z.string().describe('Current IANA timezone string.'),
    }),
    attendees: z.array(
        z.object({
            email: z.string().describe('The email of the attendee'),
            displayName: z.string().describe('Then name of the attendee.'),
        })
    ),
});

export const createCalendarEvents = tool(
    async (eventData) => {
        const { summary, start, end, attendees } = eventData as EventData;
        
        const response = await calendar.events.insert({
            calendarId: 'primary',
            conferenceDataVersion: 1,
            requestBody: {
                summary,
                start,
                end,
                attendees,
                conferenceData: {
                    createRequest: {
                        requestId: `meet-${Date.now()}`,
                        conferenceSolutionKey: {
                            type: 'hangoutsMeet',
                        },
                    },
                },
            }
        });
        if (response.status === 200) {
            return 'Event created successfully!';
        }
        return `Failed to create event`;
    },
    {
        name: 'create_calendar_events',
        description: 'Create a new calendar event',
        schema: createEventSchema,

    });

type Params = {
    q: string;
    timeMin?: string;
    timeMax?: string;
};

export const getCalendarEvents = tool(
    async (params) => {

        const { q, timeMin, timeMax } = params as Params;

        try {
            // google calendar logic
            const response = await calendar.events.list({
                calendarId: 'primary',
                q,
                timeMin: timeMin,
                timeMax: timeMax,
                // showDeleted: false,
                // singleEvents: true,
                maxResults: 3,
                // orderBy: 'startTime',
            } as any);


            const result = response.data.items?.map((event) => {
                return {
                    id: event.id,
                    summary: event.summary,
                    description: event.description,
                    location: event.location,
                    start: event.start,
                    end: event.end,
                    attendees: event.attendees,
                    creator: event.creator,
                    organizer: event.organizer,
                    status: event.status,
                    meetingLink: event.hangoutLink,
                    eventType: event.eventType,
                };
            });
            return JSON.stringify(result, null, 2);
        } catch (error) {
            console.error('Error fetching calendar events:', error);
        }
        return 'Failed to connect to Google Calendar.';

    },
    {
        name: 'get_calendar_events',
        description: 'Fetch existing calendar events',
        schema: z.object({
            q: z.string().describe('The query to be used to get events from google calendar. It can be one of these values: summary, description, location, attendees display name, attendees email, organiser\'s name, organiser\'s email'),
            timeMin: z.string().optional().describe('The minimum start time of the events to get events'),
            timeMax: z.string().optional().describe('The maximum end time of the events to get events'),
        })
    }
)

const getContanctsSchema = z.object({
    query: z.string().describe('The query to be used to get contacts from google contacts. It can be one of these values: name, email, phone number'),
    pageSize: z.number().optional().describe('The maximum number of contacts to return. The default is 10.'),
});

export const getContacts = tool(
    async (params) => {
        const { query, pageSize } = params as z.infer<typeof getContanctsSchema>;
        console.log('Fetching contacts with query:', query);
        if (!process.env.GOOGLE_ACCESS_TOKEN && !process.env.GOOGLE_REFRESH_TOKEN) {
            return 'Google Contacts authentication is not configured. Set GOOGLE_ACCESS_TOKEN or GOOGLE_REFRESH_TOKEN in your .env file.';
        }
        try {
            const response = await people.people.searchContacts({
                query,
                pageSize,
                readMask: 'names,emailAddresses,phoneNumbers',
            });
            const result = response.data.results?.map(({ person }: any) => ({
                id: person?.resourceName,
                emailAddresses: person?.emailAddresses,
                names: person?.names,
                phoneNumbers: person?.phoneNumbers,
            }));
            return JSON.stringify(result, null, 2);
        } catch (error) {
            console.error('Error fetching contacts:', error);
        }
        return 'Failed to connect to Google Contacts.';

    },
    {
        name: 'get_google_contacts',
        description: 'Fetch existing contacts from google contacts',
        schema: z.object({
            query: z.string().describe('The query to be used to get contacts from google contacts. It can be one of these values: name, email, phone number'),
            pageSize: z.number().optional().describe('The maximum number of contacts to return. The default is 10.'),
        }),
    }
);


const sendEmail = tool(
    async ({ to, subject, body, cc }) => {
        const email = [
            `To: ${to}`,
            "Content-Type: text/html; charset=utf-8",
            `Subject: ${subject}`,
            "",
            body,
        ].join("\n");
        const encodedEmail = Buffer.from(email)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        const result = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
            raw: encodedEmail,
            },
        });
        if (result.status === 200) {
            console.log("Email sent successfully!");
            return `Email sent to ${to.join(', ')} - Subject: ${subject}`;
        } else {
            console.error("Failed to send email:", result.statusText);
            return "Failed to send email.";
        }
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
    middleware: [
        humanInTheLoopMiddleware({
            interruptOn: { send_email: true },
            descriptionPrefix: "The user will review the email before sending. If the user approves, the email will be sent. If not, the user can request changes.",
        })
    ]
});

export const manageEmail = tool(
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
