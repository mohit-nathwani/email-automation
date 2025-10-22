// netlify/functions/send-from-queue.js

export async function handler() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  try {
    // 1️⃣ Fetch one pending email
    const { data: emails } = await fetch(
      `${SUPABASE_URL}/rest/v1/email_queue_v2?status=eq.pending&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    ).then((res) => res.json());

    if (!emails || emails.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No pending emails found" }),
      };
    }

    const email = emails[0];

    // 2️⃣ Fetch current rotation index from Supabase
    const trackerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rotation_tracker?id=eq.1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const trackerData = await trackerRes.json();
    let lastIndex = trackerData?.[0]?.last_used_index || 0;

    // 3️⃣ Define sender list (update these with your actual verified senders)
    const senders = [
      "mohitnathwani@outlook.com",
      "mohit.asc@outlook.com",
      "nathwanimohit@yahoo.com",
      "hiremohit@yahoo.com",
    ];

    const senderIndex = (lastIndex + 1) % senders.length;
    const sender = senders[senderIndex];

    console.log("🌀 Using sender:", sender);

    // 4️⃣ Send email via Brevo API
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Mohit Nathwani", email: sender },
        to: [{ email: email.to_email }],
        subject: email.subject,
        htmlContent: email.body,
      }),
    });

    const brevoResult = await brevoResponse.json();

    // 5️⃣ Update rotation tracker for next run
    await fetch(`${SUPABASE_URL}/rest/v1/rotation_tracker?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        last_used_index: senderIndex,
        updated_at: new Date().toISOString(),
      }),
    });

    // 6️⃣ Mark email as sent
    await fetch(`${SUPABASE_URL}/rest/v1/email_queue_v2?id=eq.${email.id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "sent",
        sent_at: new Date().toISOString(),
      }),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Email sent!",
        used_sender: sender,
        email,
        brevoResult,
      }),
    };
  } catch (err) {
    console.error("❌ Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
