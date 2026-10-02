import express, { type Request, type Response } from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

app.get('/auth', async (req: Request, res: Response) => {
    const scopes = ['https://www.googleapis.com/auth/calendar', "https://www.googleapis.com/auth/contacts.readonly", "https://www.googleapis.com/auth/gmail.send"];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
    });

    res.redirect(authUrl);
});

app.get('/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;

    const { tokens } = await oauth2Client.getToken(code as string);
    console.log('response code', tokens);
    // Exchange the authorization code for an access token
    oauth2Client.setCredentials(tokens);
    res.send('You are connected to Google Calendar and Contacts! You can close this window and return to the application.');
});

app.listen(3600, () => {
    console.log('Server is running on http://localhost:3600');
    console.log('Visit http://localhost:3600/auth to connect to Google Calendar.');
});  