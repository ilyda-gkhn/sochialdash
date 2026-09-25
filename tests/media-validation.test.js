require("./setup");
const fs=require("fs"),os=require("os"),path=require("path");
const {inspectFile,validateForPlatform}=require("../services/mediaValidation");

describe("Media signature and platform validation",()=>{
  const files=[];
  afterAll(()=>files.forEach(file=>{try{fs.unlinkSync(file);}catch(_){}}));
  function temporary(buffer,suffix){const file=path.join(os.tmpdir(),`socialdash-${Date.now()}-${Math.random()}${suffix}`);fs.writeFileSync(file,buffer);files.push(file);return file;}
  test("detects forged MIME types",()=>{const file=temporary(Buffer.from("not an image"),".png");expect(()=>inspectFile(file,"image/png")).toThrow(/gerçek biçimi/);});
  test("reads PNG dimensions and accepts a valid platform image",()=>{const header=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(header);header.writeUInt32BE(100,16);header.writeUInt32BE(50,20);const file=temporary(header,".png");const info=validateForPlatform({path:file,mime_type:"image/png"},"instagram");expect(info.dimensions).toEqual({width:100,height:50});});
  test("rejects a declared MIME mismatch",()=>{const header=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(header);header.writeUInt32BE(10,16);header.writeUInt32BE(10,20);const file=temporary(header,".png");expect(()=>inspectFile(file,"image/jpeg")).toThrow(/MIME/);});
});
