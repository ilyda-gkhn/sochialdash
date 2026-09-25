const ai=require("../services/ai");

describe("AI provider service",()=>{
  const original={...process.env};
  afterEach(()=>{process.env={...original};jest.restoreAllMocks();});

  test("reports missing configuration without fabricating a reply",async()=>{
    delete process.env.AI_API_KEY;
    await expect(ai.generateReply([{role:"user",content:"Merhaba"}])).rejects.toMatchObject({status:503});
  });

  test("calls the configured provider and returns assistant content",async()=>{
    process.env.AI_API_KEY="test-key";process.env.AI_BASE_URL="https://ai.example/v1";process.env.AI_MODEL="test-model";
    global.fetch=jest.fn().mockResolvedValue({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:" Gerçek yanıt "}}]})});
    await expect(ai.generateReply([{role:"user",content:"Merhaba"}])).resolves.toBe("Gerçek yanıt");
    const [url,request]=global.fetch.mock.calls[0];
    expect(String(url)).toBe("https://ai.example/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(request.body).model).toBe("test-model");
  });

  test("does not expose provider error payload as a fake success",async()=>{
    process.env.AI_API_KEY="test-key";
    global.fetch=jest.fn().mockResolvedValue({ok:false,status:429,text:async()=>JSON.stringify({error:{message:"rate limited"}})});
    await expect(ai.generateReply([{role:"user",content:"Merhaba"}])).rejects.toMatchObject({status:429,retryable:true});
  });
});
