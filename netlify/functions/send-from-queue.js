// netlify/functions/send-from-queue.js

export async function handler() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const MAILTRAP_API_KEY = process.env.MAILTRAP_API_KEY;

    // 🔍 Debug logs
  console.log("🔑 SUPABASE_URL:", SUPABASE_URL);
  console.log("🔑 SUPABASE_KEY length:", SUPABASE_KEY?.length);

  const senders = [
    { name: "Mohit Nathwani", email: "mohitnathwani@outlook.com" },
    { name: "Mohit Nathwani", email: "mohit.asc@outlook.com" },
    { name: "Mohit Nathwani", email: "hire_mohit@outlook.com" },
    { name: "Mohit Nathwani", email: "hire_mohit@hotmail.com" },
    { name: "Mohit Nathwani", email: "mohitnathwani@hotmail.com" },
  ];

  try {
    // 1️⃣ Fetch rotation tracker
    const { data: trackerData } = await fetch(`${SUPABASE_URL}/rest/v1/rotation_tracker`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }).then((res) => res.json());

    let lastUsedIndex = trackerData?.[0]?.last_used_index ?? -1;
    const nextIndex = (lastUsedIndex + 1) % senders.length;
    const sender = senders[nextIndex];

    console.log("🌀 Using sender:", sender.email);

    // 2️⃣ Fetch one pending email
    const { data: emails } = await fetch(`${SUPABASE_URL}/rest/v1/email_queue_v2?status=eq.pending&limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

    if (!emails || emails.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No pending emails found" }),
      };
    }

    const email = emails[0];

    // 3️⃣ Send email via Mailtrap
    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAILTRAP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: sender.email,
          name: sender.name,
        },
        to: [{ email: email.to_email }],
        subject: email.subject,
        text: email.body.replace(/<\/?[^>]+(>|$)/g, ""), // strip HTML
        html: email.body,
      }),
    });

    const result = await response.json();
    console.log("📬 Mailtrap API response:", result);

    // 4️⃣ Mark email as sent in Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/email_queue_v2?id=eq.${email.id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString() }),
    });

    // 5️⃣ Update rotation tracker
    await fetch(`${SUPABASE_URL}/rest/v1/rotation_tracker?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        last_used_index: nextIndex,
        updated_at: new Date().toISOString(),
      }),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Email sent successfully",
        used_sender: sender.email,
        result,
      }),
    };
  } catch (error) {
    console.error("❌ Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
