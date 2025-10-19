// send-email.js
import fetch from "node-fetch";

// Load secrets from environment variables
const BREVO_API_KEY = process.env.BREVO_API_KEY;

async function sendTestEmail() {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Mohit", email: "MohitNathwani55@gmail.com" },
      to: [{ email: "nmo547768@gmail.com" }], // change this to test email
      subject: "Test email from my automation tool",
      htmlContent: "<p>Hi Mohit 👋<br>This is your first test email sent via Brevo API!</p>",
    }),
  });

  const result = await response.json();
  console.log("Brevo response:", result);
}

sendTestEmail().catch(console.error);
