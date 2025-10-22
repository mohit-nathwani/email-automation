// netlify/functions/send-from-queue.js
export async function handler() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  try {
    // 1️⃣ Fetch one pending email
    const res = await fetch(`${SUPABASE_URL}/rest/v1/email_queue_v2?status=eq.pending&limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const emails = await res.json(); // 👈 fix — directly use res.json()

    if (!emails || emails.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No pending emails found" }),
      };
    }

    const email = emails[0];

    // 2️⃣ Send email via Brevo API
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Mohit", email: "MohitNathwani55@gmail.com" },
        to: [{ email: email.to_email }],
        subject: email.subject,
        htmlContent: email.body,
      }),
    });

    const brevoResult = await brevoResponse.json();

    // 3️⃣ Update status in Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/email_queue_v2?id=eq.${email.id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString() }),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent!", email, brevoResult }),
    };
  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
