const BOT_TOKEN = "7859254974:AAHgMcRDV0ODgQh_YyA7aymzOK5lkzb--6s";
const CHAT_ID = "790898350";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TradingSignal {
  pair: string;
  action: string;
  confidence: number;
  start_time: string;
  end_time: string;
  session: string;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes} EAT`;
}

async function sendTelegramMessage(message: string): Promise<Response> {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    return response;
  } catch (error) {
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { signal }: { signal: TradingSignal } = await req.json();

    const actionEmoji = signal.action === "BUY" ? "📈" : "📉";
    const actionText = signal.action === "BUY" ? "BUY/CALL" : "SELL/PUT";

    const message = `
<b>⚡ BOLT APP Trading Signal ⚡</b>

📊 <b>Pair:</b> ${signal.pair}

<b>Action:</b> ${actionText} ${actionEmoji}

🎯 <b>Confidence:</b> ${signal.confidence}% 🔥

⏰ <b>Start Time:</b> ${formatTime(signal.start_time)}

🏁 <b>End Time:</b> ${formatTime(signal.end_time)}

📍 <b>Session:</b> ${signal.session} Session
    `.trim();

    const telegramResponse = await sendTelegramMessage(message);
    const data = await telegramResponse.json();

    if (!data.ok) {
      throw new Error(data.description || "Failed to send Telegram message");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Signal sent to Telegram" }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});