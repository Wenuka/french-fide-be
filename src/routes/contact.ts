import { Router } from 'express';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const router = Router();

const apiKey = process.env.MAILGUN_API_KEY;
const domain = process.env.MAILGUN_DOMAIN || 'fideprep.ch';
const url = process.env.MAILGUN_URL || 'https://api.eu.mailgun.net';
const recipient = process.env.MAILGUN_RECIPIENT || 'info@fideprep.ch';

const mailgun = new Mailgun(FormData);
const client = mailgun.client({ username: 'api', key: apiKey || '', url });

router.post('/', async (req, res) => {
    const { user_name, user_email, message } = req.body;

    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
        console.error('Mailgun configuration missing');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const emailData = {
        from: `FIDE Prep Contact Form <mailgun@${domain}>`,
        to: [recipient],
        subject: `New Contact Form Submission from ${user_name || 'User'}`,
        text: `Name: ${user_name || 'N/A'}\nEmail: ${user_email || 'N/A'}\n\nMessage:\n${message}`,
        'h:Reply-To': user_email || undefined,
    };

    try {
        await client.messages.create(domain || '', emailData);
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email via Mailgun:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

export default router;
