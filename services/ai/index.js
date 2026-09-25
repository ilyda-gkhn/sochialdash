function isConfigured() { return Boolean(process.env.AI_API_KEY); }

function endpoint() {
  const base=String(process.env.AI_BASE_URL||"https://api.openai.com/v1").replace(/\/$/,"");
  let url;
  try{url=new URL(`${base}/chat/completions`);}catch(_){throw Object.assign(new Error("AI_BASE_URL geçerli bir adres değil."),{status:500});}
  const local=["localhost","127.0.0.1","::1"].includes(url.hostname);
  if(url.protocol!=="https:" && !(local&&process.env.NODE_ENV!=="production"))throw Object.assign(new Error("AI_BASE_URL HTTPS kullanmalıdır."),{status:500});
  return url;
}

async function callProvider(messages, systemPrompt="Sen SocialDash içinde çalışan, sosyal medya içerikleri konusunda yardımcı bir asistansın. Kullanıcının dilinde, uygulanabilir ve kısa yanıt ver.") {
  if (!isConfigured()) throw Object.assign(new Error("AI servisi yapılandırılmadı: AI_API_KEY tanımlı değil."),{status:503,code:"AI_NOT_CONFIGURED"});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Number(process.env.AI_TIMEOUT_MS)||30000);
  try{
    const response=await fetch(endpoint(),{method:"POST",signal:controller.signal,headers:{Authorization:`Bearer ${process.env.AI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.AI_MODEL||"gpt-4o-mini",messages:[{role:"system",content:systemPrompt},...messages.slice(-30).map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content).slice(0,12000)}))],temperature:0.7,max_tokens:Number(process.env.AI_MAX_TOKENS)||800})});
    const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{};}catch(_){payload={};}
    if(!response.ok){const detail=payload?.error?.message||`HTTP ${response.status}`;throw Object.assign(new Error(`AI sağlayıcı hatası: ${detail}`),{status:response.status===429?429:502,retryable:response.status===429||response.status>=500});}
    const content=payload?.choices?.[0]?.message?.content;
    if(typeof content!=="string"||!content.trim())throw Object.assign(new Error("AI sağlayıcı boş yanıt döndürdü."),{status:502});
    return content.trim();
  }catch(err){if(err.name==="AbortError")throw Object.assign(new Error("AI sağlayıcı zaman aşımına uğradı."),{status:504,retryable:true});throw err;}finally{clearTimeout(timer);}
}

const generateReply = history => callProvider(history);
const generateHashtags = text => callProvider([{role:"user",content:text}],"Verilen içerik için uygun, spam olmayan 8-12 hashtag üret. Yalnızca boşlukla ayrılmış hashtagleri döndür.");
const generateCaption = (topic,tone) => callProvider([{role:"user",content:`Konu: ${topic}\nTon: ${tone||"etkileyici"}`}],"Sosyal medya için tek bir yayına hazır açıklama yaz. Kullanıcının dilini kullan.");
const generateContentIdeas = topic => callProvider([{role:"user",content:topic}],"Verilen konu için birbirinden farklı 5 uygulanabilir sosyal medya içerik fikri üret. Numaralı ve kısa yaz.");

module.exports={isConfigured,callProvider,generateReply,generateHashtags,generateCaption,generateContentIdeas};
