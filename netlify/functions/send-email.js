// netlify/functions/send-email.js
import fetch from "node-fetch";

export async function handler(event, context) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  const body = JSON.parse(event.body || "{}");
  const toEmail = body.to || "mohitnathwani55@gmail.com";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Mohit", email: "MohitNathwani55@gmail.com" },
      to: [{ email: toEmail }],
      subject: "Test email from your automation app 🚀",
      htmlContent: "<p>Hi Mohit! 👋<br>This is your first automated email sent via Netlify & Brevo.</p>",
    }),
  });

  const result = await response.json();
  console.log("Brevo API response:", result);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
}
