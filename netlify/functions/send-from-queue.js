// netlify/functions/send-from-queue.js

export async function handler() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  try {
    // Fetch one pending email
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: email, error } = await supabase
      .from("email_queue_v2")
      .select("*")
      .eq("status", "pending")
      .order("scheduled_time", { ascending: true })
      .limit(1)
      .single();

    if (error || !email) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No pending emails found" }),
      };
    }

    // Send via Brevo API
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
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

    const result = await response.json();

    // Update Supabase status
    await supabase
      .from("email_queue_v2")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", email.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent!", email, brevoResult: result }),
    };
  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
