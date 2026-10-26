import { GoogleGenAI, Modality } from '@google/genai';
import './style.css';

const $ = id => document.getElementById(id);

let session = null;
let stream = null;
let ctx = null;
let processor = null;
let source = null;
let live = false;
let help = true;
let playAt = 0;
let playing = [];

const instructions = `
You are BOLO AI, a skilled, warm female English-speaking coach.
You know English, Hindi and Bengali very well.
Teach fluency, grammar, vocabulary, pronunciation, sentence patterns,
interviews and real-life conversations.
Understand Hindi and Bengali when the learner struggles.
Speak simply and naturally.
Gently correct mistakes and explain them in Hindi when useful.
Use practical exercises, shadowing and sentence frames.
Ask one question at a time and keep spoken answers concise.
`;

function status(text) {
  $('status').textContent = text;
}

function add(who, text) {
  const article = document.createElement('article');

  if (who === 'you') article.className = 'you';

  const heading = document.createElement('b');
  heading.textContent = who === 'you' ? 'YOU' : 'BOLO AI';

  const paragraph = document.createElement('p');
  paragraph.textContent = text;

  article.append(heading, paragraph);
  $('chat').append(article);
  $('chat').scrollTop = $('chat').scrollHeight;
}

function from64(s) {
  const r = atob(s);
  const u = new Uint8Array(r.length);

  for (let i = 0; i < r.length; i++) {
    u[i] = r.charCodeAt(i);
  }

  return u;
}

function to64(u) {
  let s = '';

  for (let i = 0; i < u.length; i += 16000) {
    s += String.fromCharCode(
      ...u.subarray(i, Math.min(i + 16000, u.length))
    );
  }

  return btoa(s);
}

function pcm(f) {
  const buffer = new ArrayBuffer(f.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < f.length; i++) {
    const x = Math.max(-1, Math.min(1, f[i]));

    view.setInt16(
      i * 2,
      x < 0 ? x * 32768 : x * 32767,
      true
    );
  }

  return new Uint8Array(buffer);
}

function play(s) {
  if (!ctx) return;

  const u = from64(s);
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength);
  const f = new Float32Array(Math.floor(u.length / 2));

  for (let i = 0; i < f.length; i++) {
    f[i] = v.getInt16(i * 2, true) / 32768;
  }

  const buffer = ctx.createBuffer(1, f.length, 24000);
  buffer.copyToChannel(f, 0);

  const node = ctx.createBufferSource();
  node.buffer = buffer;
  node.connect(ctx.destination);

  playAt = Math.max(playAt, ctx.currentTime + 0.025);

  node.start(playAt);
  playAt += buffer.duration;

  playing.push(node);
  $('portrait').classList.add('speaking');

  node.onended = () => {
    playing = playing.filter(item => item !== node);

    if (!playing.length) {
      $('portrait').classList.remove('speaking');
    }
  };
}

function stopPlay() {
  playing.forEach(node => {
    try {
      node.stop();
    } catch {}
  });

  playing = [];
  playAt = 0;
  $('portrait').classList.remove('speaking');
}

async function end(close = true) {
  live = false;

  try {
    processor?.disconnect();
    source?.disconnect();
    stream?.getTracks().forEach(track => track.stop());

    if (close) session?.close();

    await ctx?.close();
  } catch {}

  stopPlay();

  session = null;
  stream = null;
  ctx = null;
  processor = null;
  source = null;

  $('start').disabled = false;
  $('stop').disabled = true;

  $('start').innerHTML =
    '🎙 <span><b>Start talking</b><small>Live voice conversation</small></span>';

  status('Ready when you are');
}

async function start() {
  try {
    status('Connecting…');

    const response = await fetch('/api/live-token', {
      method: 'POST'
    });

    const data = await response.json();

    if (!response.ok) {
      throw Error(data.error || 'Could not connect');
    }

    const ai = new GoogleGenAI({
      apiKey: data.token
    });

    session = await ai.live.connect({
      model: 'gemini-3.8-live',

      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: instructions,

        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore'
            }
          }
        }
      },

      callbacks: {
        onopen: () => {
          status('Listening — speak naturally');
        },

        onmessage: message => {
          const content = message.serverContent;

          if (content?.inputTranscription?.text) {
            $('hint').textContent =
              'You: ' + content.inputTranscription.text;
          }

          if (content?.outputTranscription?.text) {
            add('tutor', content.outputTranscription.text);
          }

          for (const part of content?.modelTurn?.parts || []) {
            if (
              part.inlineData?.data &&
              part.inlineData.mimeType?.includes('audio')
            ) {
              play(part.inlineData.data);
            }
          }

          if (content?.interrupted) {
            stopPlay();
          }
        },

        onerror: error => {
          console.error(error);
          status('Connection issue');
          $('hint').textContent = 'Check API access and quota.';
        },

        onclose: () => {
          if (live) end(false);
        }
      }
    });

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });

    await ctx.resume();

    source = ctx.createMediaStreamSource(stream);
    processor = ctx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = event => {
      if (live && session) {
        session.sendRealtimeInput({
          audio: {
            data: to64(pcm(event.inputBuffer.getChannelData(0))),
            mimeType: 'audio/pcm;rate=16000'
          }
        });
      }
    };

    source.connect(processor);
    processor.connect(ctx.destination);

    live = true;

    $('start').disabled = true;
    $('stop').disabled = false;

    $('start').innerHTML =
      '🎙 <span><b>Listening…</b><small>Speak naturally</small></span>';

    status('Listening — speak naturally');

    $('hint').textContent =
      'Say a full sentence. You can interrupt naturally.';

  } catch (error) {
    console.error(error);

    status('Setup needed');

    $('hint').textContent =
      error.message || 'Allow microphone access and check API key.';

    await end(false);
  }
}

$('start').onclick = start;
$('stop').onclick = () => end(true);

$('lang').onclick = () => {
  help = !help;

  $('lang').textContent = help ? 'Hindi help' : 'English only';

  add(
    'tutor',
    help
      ? 'Hindi help is on. I’ll explain difficult points briefly in Hindi.'
      : 'English-only practice selected.'
  );
};

async function send(text) {
  text = text.trim();

  if (!text) return;

  add('you', text);
  $('input').value = '';

  if (live && session) {
    session.sendRealtimeInput({ text });
    return;
  }

  try {
    status('Thinking…');

    const response = await fetch('/api/text-coach', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        message: text,
        help
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw Error(data.error);
    }

    add('tutor', data.reply);
    status('Ready when you are');

  } catch (error) {
    add(
      'tutor',
      'I could not connect. Check your API key and try again.'
    );

    $('hint').textContent = error.message;
    status('Setup needed');
  }
}

$('form').onsubmit = event => {
  event.preventDefault();
  send($('input').value);
};
