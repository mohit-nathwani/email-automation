// netlify/functions/send-from-queue.cjs

exports.handler = async function () {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const TENANT_ID = process.env.AZURE_TENANT_ID;
  const CLIENT_ID = process.env.AZURE_CLIENT_ID;
  const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
  const SENDER_EMAIL = process.env.SENDER_EMAIL;

  try {
    // 1️⃣ Get Azure OAuth token
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error("No access token received from Azure");
    }
    const accessToken = tokenData.access_token;

    // 2️⃣ Fetch one pending email from Supabase
    const pendingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_queue_v2?status=eq.pending&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const emails = await pendingRes.json();
    if (!emails || emails.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No pending emails found" }),
      };
    }

    const email = emails[0];
    console.log("📬 Found pending email:", email);

    // 3️⃣ Send email using Microsoft Graph (App-only)
    const sendMailResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_EMAIL)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: email.subject || "(no subject)",
            body: {
              contentType: "HTML",
              content: email.body || "",
            },
            from: {
              emailAddress: {
                address: SENDER_EMAIL,
              },
            },
            toRecipients: [
              {
                emailAddress: { address: email.to_email },
              },
            ],
          },
          saveToSentItems: false,
        }),
      }
    );

    if (!sendMailResponse.ok) {
      const errText = await sendMailResponse.text();
      throw new Error(`Email send failed (${sendMailResponse.status}): ${errText}`);
    }

    console.log("✅ Email sent successfully via Graph API");

    // 4️⃣ Mark the email as sent
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
        message: "✅ Email sent successfully via Outlook Graph API",
        sent_to: email.to_email,
      }),
    };
  } catch (err) {
    console.error("❌ Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
