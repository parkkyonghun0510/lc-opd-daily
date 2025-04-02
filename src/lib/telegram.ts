export async function sendTelegramNotification(message: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram notification not sent: Missing environment variables')
    return
  }
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    )
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error sending Telegram notification:', error)
  }
}

/**
 * Escapes characters that have special meaning in Telegram MarkdownV2.
 * See: https://core.telegram.org/bots/api#markdownv2-style
 * 
 * @param text The text to escape.
 * @returns The escaped text.
 */
export function escapeTelegramMarkdown(text: string): string {
  if (!text) return '';
  // Characters to escape: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}