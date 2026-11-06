import express from 'express';import cors from 'cors';import dotenv from 'dotenv';import path from 'path';import {fileURLToPath} from 'url';import {GoogleGenAI} from '@google/genai';dotenv.config();const app=express(),port=process.env.PORT||3001,dir=path.dirname(fileURLToPath(import.meta.url));app.set('trust proxy',1);
// CORS: the app is served by this same server, so browsers on other sites are blocked.
// Add extra origins with ALLOWED_ORIGINS (comma-separated).
const allowedOrigins=new Set(['http://localhost:5173','http://localhost:3001',...(process.env.ALLOWED_ORIGINS||'').split(',')].map(o=>o.trim()).filter(Boolean));
app.use(cors({origin(origin,cb){cb(null,!origin||allowedOrigins.has(origin))}}));
app.use(express.json({limit:'50kb'}));
// Rate limits: protect the Gemini bill/quota from abuse.
const MIN=60*1000,DAY=24*60*60*1000;
const visitors=new Map();let globalDay={start:Date.now(),count:0};
function limiter(name,perMinute,perDay){return(req,res,next)=>{const now=Date.now();
if(now-globalDay.start>=DAY)globalDay={start:now,count:0};
if(globalDay.count>=(Number(process.env.GLOBAL_DAILY_LIMIT)||1000))return res.status(429).json({error:"BOLO AI has reached today's limit. Please try again tomorrow."});
const k=name+':'+(req.ip||'unknown');let v=visitors.get(k);
if(!v){v={m:now,mc:0,d:now,dc:0};visitors.set(k,v)}
if(now-v.m>=MIN){v.m=now;v.mc=0}if(now-v.d>=DAY){v.d=now;v.dc=0}
if(v.mc>=perMinute)return res.status(429).json({error:'Too many requests. Please wait a minute.'});
if(v.dc>=perDay)return res.status(429).json({error:"You've reached today's limit. Please come back tomorrow."});
v.mc++;v.dc++;globalDay.count++;next()}}
setInterval(()=>{const cut=Date.now()-DAY;for(const[k,v]of visitors)if(v.d<cut)visitors.delete(k)},60*60*1000).unref();
const liveLimit=limiter('live',Number(process.env.LIVE_LIMIT_PER_MINUTE)||3,Number(process.env.LIVE_LIMIT_PER_DAY)||20);
const textLimit=limiter('text',Number(process.env.TEXT_LIMIT_PER_MINUTE)||10,Number(process.env.TEXT_LIMIT_PER_DAY)||150);
function key(res){if(!process.env.GEMINI_API_KEY||process.env.GEMINI_API_KEY.includes('PASTE_YOUR')){res.status(503).json({error:'Gemini API key missing. Copy .env.example to .env and add your key.'});return false}return true}
app.post('/api/live-token',liveLimit,async(req,res)=>{if(!key(res))return;try{const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});const t=await ai.authTokens.create({config:{uses:1,expireTime:new Date(Date.now()+30*60*1000).toISOString(),newSessionExpireTime:new Date(Date.now()+60*1000),liveConnectConstraints:{model:'gemini-3.8-live',config:{responseModalities:['AUDIO'],inputAudioTranscription:{},outputAudioTranscription:{},speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}},systemInstruction:'You are BOLO AI, a kind female English teacher. Help the learner practice English. Use simple English and brief Hindi or Bengali explanations when useful. Correct mistakes gently.'}}}});res.json({token:t.name})}catch(e){console.error(e.message);res.status(502).json({error:'Gemini could not issue a Live token. Check API access, model availability and quota.'})}});
app.post('/api/text-coach',textLimit,async(req,res)=>{if(!key(res))return;const message=String(req.body?.message||'').slice(0,3000);if(!message.trim())return res.status(400).json({error:'Please enter a message.'});try{const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});const out=await ai.models.generateContent({model:'gemini-2.5-flash',contents:message,config:{systemInstruction:'You are BOLO AI, an expert English teacher fluent in English, Hindi and Bengali. Teach fluency, grammar, vocabulary, daily conversation and interview English. Correct kindly, explain briefly and practically.'}});res.json({reply:out.text||'Let’s try again. What would you like to practice?'})}catch(e){console.error(e.message);res.status(502).json({error:'Gemini request failed. Check API access and quota.'})}});
app.use(express.static(path.join(dir,'dist')));app.get('*',(req,res,next)=>{if(req.path.startsWith('/api/'))return next();res.sendFile(path.join(dir,'dist','index.html'),e=>{if(e)res.status(404).send('Run npm run build first.')})});app.listen(port,()=>console.log('BOLO AI server listening on '+port));