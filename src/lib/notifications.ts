type NotificationMessage = {
  title: string;
  message: string;
  deepLink: string;
  email?: {
    to: string[];
    subject: string;
    html: string;
  };
};

type NotificationResult = {
  email: "sent" | "skipped" | "failed";
  teams: "sent" | "skipped" | "failed";
  errors: string[];
};

function appBaseUrl() {
  return process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export function atomQuestLink(path = "/", params?: Record<string, string | undefined>) {
  const url = new URL(path, appBaseUrl());
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function sendNotification(message: NotificationMessage): Promise<NotificationResult> {
  const result: NotificationResult = { email: "skipped", teams: "skipped", errors: [] };

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM && message.email?.to.length) {
    let sentCount = 0;
    const recipients = [...new Set(message.email.to)];

    for (const recipient of recipients) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [recipient],
            subject: message.email.subject,
            html: message.email.html,
          }),
        });
        if (response.ok) {
          sentCount += 1;
        } else {
          result.errors.push(`Resend returned ${response.status} for ${recipient}.`);
        }
      } catch (error) {
        result.errors.push(error instanceof Error ? `${recipient}: ${error.message}` : `${recipient}: Email notification failed.`);
      }
    }

    result.email = sentCount > 0 ? "sent" : "failed";
  }

  if (process.env.TEAMS_WEBHOOK_URL) {
    try {
      const response = await fetch(process.env.TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              contentUrl: null,
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.4",
                body: [
                  { type: "TextBlock", text: message.title, weight: "Bolder", size: "Medium", wrap: true },
                  { type: "TextBlock", text: message.message, wrap: true },
                ],
                actions: [
                  {
                    type: "Action.OpenUrl",
                    title: "Open in WorkSphere",
                    url: message.deepLink,
                  },
                ],
              },
            },
          ],
        }),
      });
      result.teams = response.ok ? "sent" : "failed";
      if (!response.ok) result.errors.push(`Teams webhook returned ${response.status}.`);
    } catch (error) {
      result.teams = "failed";
      result.errors.push(error instanceof Error ? error.message : "Teams notification failed.");
    }
  }

  return result;
}
