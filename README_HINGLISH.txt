BOLO AI — STARTER MVP
Naam: BOLO AI
Tagline: Talk Naturally. Connect Instantly.

Included:
- Mobile-friendly English coach UI
- Hindi-help toggle
- Text coaching through Gemini
- Gemini Live API voice-conversation integration starter
- Short-lived Live API token generated server-side

Important:
Yeh starter MVP hai, production-ready app nahi. Selected photo par true phoneme-by-phoneme real-human lip-sync included nahi hai; speaking ke waqt photo glow/scale animation hota hai. Realistic photo lip-sync ke liye alag real-time avatar technology/model/service chahiye.
API quota/model access change ho sakta hai. Google AI Pro consumer subscription ka matlab unlimited Gemini API usage nahi hota. API key ko frontend mein kabhi mat daalna.

Setup (computer/laptop easiest):
1. Node.js 20+ install karo.
2. ZIP extract karo.
3. .env.example ko copy karke .env naam do.
4. .env mein apni Gemini API key set karo: GEMINI_API_KEY=your_key
5. Terminal project folder mein kholo:
   npm install
   npm run dev
6. Terminal mein Vite URL open karo (usually http://localhost:5173).
   Server API ke liye port 3001 use karta hai.

Deployment:
npm install && npm run build, then node server.js.
Hosting ke Environment Variables mein GEMINI_API_KEY set karo. .env ko GitHub par upload mat karna. Browser microphone localhost ya HTTPS par chalta hai.

Troubleshooting:
- API key missing: .env check karke server restart karo.
- Voice connect nahi: Gemini Live API model access/quota check karo.
- Mic issue: browser permission allow karo.
- Agar model tumhare account mein available nahi, server/client code mein model name update karna padega.

Official docs:
https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket
