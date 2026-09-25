const fs=require("fs"),path=require("path"),crypto=require("crypto");
const root=path.resolve(__dirname,".."),target=path.join(root,".env");
if(fs.existsSync(target)){console.log("Mevcut .env korundu.");process.exit(0);}
const secret=()=>crypto.randomBytes(48).toString("hex");
const template=fs.readFileSync(path.join(root,".env.example"),"utf8")
 .replace(/^JWT_SECRET=.*$/m,`JWT_SECRET=${secret()}`)
 .replace(/^SOCIAL_TOKEN_ENCRYPTION_KEY=.*$/m,`SOCIAL_TOKEN_ENCRYPTION_KEY=${secret()}`);
fs.writeFileSync(target,template,{flag:"wx",mode:0o600});
console.log("Yerel .env oluşturuldu. Şimdi npm start çalıştırabilirsiniz.");
