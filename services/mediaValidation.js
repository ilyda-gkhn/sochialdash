const fs=require("fs");

const limits={
  instagram:{image:8*1024**2,video:25*1024**2},facebook:{image:10*1024**2,video:25*1024**2},
  threads:{image:8*1024**2,video:25*1024**2},x:{image:5*1024**2,video:25*1024**2},
  linkedin:{image:10*1024**2,video:25*1024**2},tiktok:{video:25*1024**2},youtube:{video:25*1024**2}
};

function detectedMime(buffer){
  if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return "image/jpeg";
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";
  if(buffer.length>=6&&["GIF87a","GIF89a"].includes(buffer.subarray(0,6).toString("ascii")))return "image/gif";
  if(buffer.length>=12&&buffer.subarray(4,8).toString("ascii")==="ftyp"){const brand=buffer.subarray(8,12).toString("ascii");return brand.startsWith("qt")?"video/quicktime":"video/mp4";}
  return null;
}
function imageDimensions(buffer,mime){
  if(mime==="image/png"&&buffer.length>=24)return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
  if(mime==="image/gif"&&buffer.length>=10)return {width:buffer.readUInt16LE(6),height:buffer.readUInt16LE(8)};
  if(mime==="image/jpeg"){let offset=2;while(offset+9<buffer.length){if(buffer[offset]!==0xff){offset+=1;continue;}const marker=buffer[offset+1],length=buffer.readUInt16BE(offset+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {height:buffer.readUInt16BE(offset+5),width:buffer.readUInt16BE(offset+7)};if(length<2)break;offset+=2+length;}}
  return null;
}
function inspectFile(filePath,declaredMime){
  const stat=fs.statSync(filePath);if(!stat.isFile()||stat.size===0)throw new Error("Medya dosyası boş veya geçersiz.");
  const handle=fs.openSync(filePath,"r");const buffer=Buffer.alloc(Math.min(stat.size,256*1024));fs.readSync(handle,buffer,0,buffer.length,0);fs.closeSync(handle);
  const actualMime=detectedMime(buffer);if(!actualMime)throw new Error("Dosyanın gerçek biçimi tanınamadı.");
  if(actualMime!==declaredMime&&!(actualMime==="image/jpeg"&&declaredMime==="image/jpg"))throw new Error("Dosya içeriği bildirilen MIME türüyle uyuşmuyor.");
  const dimensions=imageDimensions(buffer,actualMime);if(dimensions&&(dimensions.width<1||dimensions.height<1||dimensions.width*dimensions.height>36_152_320))throw new Error("Görsel boyutları geçersiz veya 36 megapiksel sınırını aşıyor.");
  return {mime:actualMime,size:stat.size,dimensions};
}
function validateForPlatform(media,platform){const info=inspectFile(media.path,media.mime_type),kind=info.mime.startsWith("video/")?"video":"image",limit=limits[platform]?.[kind];if(!limit)throw new Error(`${platform} bu medya türünü desteklemiyor.`);if(info.size>limit)throw new Error(`${platform} için dosya boyutu sınırı aşıldı (${Math.round(limit/1024**2)} MB).`);return info;}
function validateCollection(items,platform){const max={instagram:10,facebook:1,threads:10,x:4,linkedin:20,tiktok:1,youtube:1}[platform]||1;if(items.length>max)throw new Error(`${platform} en fazla ${max} medya kabul ediyor.`);const videos=items.filter(item=>item.mime_type.startsWith("video/"));if(["x","linkedin","facebook"].includes(platform)&&items.length>1&&videos.length)throw new Error(`${platform} çoklu medya gönderisinde video ile diğer medyaları karıştırmaya izin vermiyor.`);if(["tiktok","youtube"].includes(platform)&&(items.length!==1||videos.length!==1))throw new Error(`${platform} için tek bir video zorunludur.`);return items.map(item=>validateForPlatform(item,platform));}
module.exports={inspectFile,validateForPlatform,validateCollection,detectedMime,imageDimensions};
