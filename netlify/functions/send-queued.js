// netlify/functions/send-queued.js
import { createClient } from '@supabase/supabase-js';

// Use built-in fetch (no imports needed)
export async function handler() {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1️⃣ Find the next queued email
  const { data: queuedEmails, error } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'queued')
    .lt('scheduled_at', new Date().toISOString())
    .limit(1);

  if (error) {
    console.error('Error fetching email:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  if (!queuedEmails || queuedEmails.length === 0) {
    console.log('No emails to send');
    return { statusCode: 200, body: 'No queued emails found' };
  }

  const email = queuedEmails[0];
  console.log('Sending email to:', email.email);

  // 2️⃣ Send email via Brevo
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Mohit', email: 'MohitNathwani55@gmail.com' },
      to: [{ email: email.email }],
      subject: email.subject,
      htmlContent: email.body,
    }),
  });

  const result = await response.json();

  if (result.messageId) {
    // 3️⃣ Mark as sent
    await supabase
      .from('email_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', email.id);

    console.log('✅ Email sent to:', email.email);
    return { statusCode: 200, body: JSON.stringify({ sent: email.email }) };
  } else {
    // 4️⃣ Mark as failed
    await supabase
      .from('email_queue')
      .update({ status: 'failed', error_message: JSON.stringify(result) })
      .eq('id', email.id);

    console.error('❌ Failed to send email:', result);
    return { statusCode: 500, body: JSON.stringify(result) };
  }
}
