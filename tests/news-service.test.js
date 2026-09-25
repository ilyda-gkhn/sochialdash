const news=require("../services/news");

describe("news provider service",()=>{
  const original={...process.env};
  afterEach(()=>{process.env={...original};news.clearCache();jest.restoreAllMocks();});
  test("requires a provider key",async()=>{delete process.env.NEWS_API_KEY;await expect(news.fetchNews({trending:true})).rejects.toMatchObject({status:503});});
  test("normalizes only secure real article URLs and caches provider results",async()=>{
    process.env.NEWS_API_KEY="key";
    global.fetch=jest.fn().mockResolvedValue({ok:true,status:200,text:async()=>JSON.stringify({status:"ok",articles:[{title:"Instagram AI tools",description:"Creator update",url:"https://news.example/item",urlToImage:"http://unsafe.example/a.jpg",publishedAt:"2026-08-17T10:00:00Z",source:{name:"Example"}},{title:"Unsafe",url:"http://bad.example"}]})});
    const first=await news.fetchNews({trending:true}),second=await news.fetchNews({trending:true});
    expect(first).toHaveLength(1);expect(first[0]).toMatchObject({platform:"Instagram",category:"ai",source:"Example",date:"2026-08-17",imageUrl:null});expect(second).toEqual(first);expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].headers["X-Api-Key"]).toBe("key");
  });
  test("maps provider errors without returning sample articles",async()=>{process.env.NEWS_API_KEY="key";global.fetch=jest.fn().mockResolvedValue({ok:false,status:401,text:async()=>JSON.stringify({status:"error",message:"invalid key"})});await expect(news.fetchNews()).rejects.toMatchObject({status:502});});
});
