"use client";
import Script from "next/script";
export function TelegramFrame() {
  return <Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => {
    const app = (window as Window & { Telegram?: { WebApp?: { ready: () => void; expand: () => void } } }).Telegram?.WebApp;
    app?.ready(); app?.expand();
  }} />;
}
