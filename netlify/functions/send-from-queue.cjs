// netlify/functions/send-from-queue.cjs
// No imports needed — Node 18+ has global `fetch`.

exports.handler = async function () {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const TENANT_ID = process.env.AZURE_TENANT_ID;
  const CLIENT_ID = process.env.AZURE_CLIENT_ID;
  const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
  const SENDER_EMAIL = process.env.SENDER_EMAIL;

  try {
    // 1) OAuth token from Azure AD (client credentials)
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
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Azure token error:", tokenData);
      throw new Error(
        `Azure token request failed (${tokenRes.status}): ${JSON.stringify(
          tokenData
        )}`
      );
    }
    const accessToken = tokenData.access_token;

    // 2) Fetch one pending email
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
    if (!pendingRes.ok) {
      const txt = await pendingRes.text();
      throw new Error(
        `Supabase fetch failed (${pendingRes.status}): ${txt || "no body"}`
      );
    }
    const emails = await pendingRes.json();
    console.log("📬 Supabase pending emails:", emails);

    if (!Array.isArray(emails) || emails.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No pending emails found" }),
      };
    }

    const email = emails[0];

    // 3) Send via Microsoft Graph
    console.log("📤 Sending email via Microsoft Graph as:", SENDER_EMAIL);

    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
        SENDER_EMAIL
      )}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: email.subject || "",
            body: {
              contentType: "HTML",
              content: email.body || "",
            },
            toRecipients: [
              { emailAddress: { address: email.to_email } },
            ],
          },
          saveToSentItems: false,
        }),
      }
    );

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Graph sendMail error:", errText);
      throw new Error(
        `Email send failed (${sendRes.status}): ${errText || "no body"}`
      );
    }

    console.log("✅ Email sent, marking row as sent…");

    // 4) Mark as sent
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_queue_v2?id=eq.${email.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: "sent",
          sent_at: new Date().toISOString(),
        }),
      }
    );

    if (!patchRes.ok) {
      const txt = await patchRes.text();
      throw new Error(
        `Supabase update failed (${patchRes.status}): ${txt || "no body"}`
      );
    }

    const saved = await patchRes.json();
    console.log("📝 Updated row:", saved);

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
