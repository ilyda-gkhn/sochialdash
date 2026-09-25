const crypto=require("crypto");
const cache=new Map();
function isConfigured(){return Boolean(process.env.NEWS_API_KEY);}
const clean=value=>String(value||"").trim().slice(0,200);
function infer(text,options,fallback){const lower=text.toLowerCase();return options.find(([key,words])=>words.some(word=>lower.includes(word)))?.[0]||fallback;}
function normalizeArticles(articles){return (articles||[]).filter(a=>a?.title&&a?.url&&/^https:\/\//i.test(a.url)).map((a,index)=>{const text=`${a.title} ${a.description||""}`;const platform=infer(text,[["Instagram",["instagram"]],["Facebook",["facebook"]],["X",["twitter"," x "]],["LinkedIn",["linkedin"]],["TikTok",["tiktok"]],["YouTube",["youtube"]],["Threads",["threads"]]],"X");const category=infer(text,[["ai",[" ai ","artificial intelligence","yapay zeka"]],["content",["content","creator"]],["creator-tools",["tool","app"]],["search",["search","seo"]],["community",["community"]]],"social");return {id:Number.parseInt(crypto.createHash("sha256").update(a.url).digest("hex").slice(0,12),16),title:a.title,titleEn:a.title,desc:a.description||"",descEn:a.description||"",url:a.url,source:a.source?.name||"NewsAPI",date:String(a.publishedAt||"").slice(0,10),publishedAt:a.publishedAt||null,imageUrl:/^https:\/\//i.test(a.urlToImage||"")?a.urlToImage:null,platform,category,trend:category,popularity:Math.max(1,100-index)};});}

async function fetchNews(filters={}){
  if(!isConfigured())throw Object.assign(new Error("Haber servisi yapılandırılmadı: NEWS_API_KEY tanımlı değil."),{status:503,code:"NEWS_NOT_CONFIGURED"});
  const key=JSON.stringify(filters),ttl=Number(process.env.NEWS_CACHE_SECONDS)||300,hit=cache.get(key);
  if(hit&&Date.now()-hit.at<ttl*1000)return hit.data;
  const query=clean([filters.search,filters.platform].filter(Boolean).join(" "));
  const trending=filters.trending||!query;
  const url=new URL(trending?"https://newsapi.org/v2/top-headlines":"https://newsapi.org/v2/everything");
  if(trending){url.searchParams.set("country",clean(process.env.NEWS_COUNTRY||"us"));const allowed=["business","entertainment","general","health","science","sports","technology"];if(allowed.includes(filters.category))url.searchParams.set("category",filters.category);if(query)url.searchParams.set("q",query);}
  else{url.searchParams.set("q",query);url.searchParams.set("sortBy","publishedAt");url.searchParams.set("language",clean(process.env.NEWS_LANGUAGE||"en"));}
  url.searchParams.set("pageSize",String(Math.min(Number(process.env.NEWS_PAGE_SIZE)||50,100)));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Number(process.env.NEWS_TIMEOUT_MS)||12000);
  try{const response=await fetch(url,{signal:controller.signal,headers:{"X-Api-Key":process.env.NEWS_API_KEY}});const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{};}catch(_){}
    if(!response.ok||payload.status==="error")throw Object.assign(new Error(`Haber sağlayıcı hatası: ${payload.message||`HTTP ${response.status}`}`),{status:response.status===429?429:502});
    const data=normalizeArticles(payload.articles);cache.set(key,{at:Date.now(),data});if(cache.size>100)cache.delete(cache.keys().next().value);return data;
  }catch(err){if(err.name==="AbortError")throw Object.assign(new Error("Haber sağlayıcı zaman aşımına uğradı."),{status:504});throw err;}finally{clearTimeout(timer);}
}
function clearCache(){cache.clear();}
module.exports={isConfigured,fetchNews,normalizeArticles,clearCache};
