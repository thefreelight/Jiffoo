import { expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import { PLUGIN_MAX_ZIP_SIZE, PLUGIN_MAX_ENTRY_SIZE, PLUGIN_MAX_DECOMPRESSED_SIZE, PLUGIN_MAX_ZIP_ENTRIES, readPluginZipEntries, verifyPluginZip } from 'shared/plugin-signing';

async function zip(entries: Array<{name:string; content:Buffer}>) {
  const output=new PassThrough(), chunks:Buffer[]=[];
  const done=new Promise<Buffer>((resolve,reject)=>{output.on('data',value=>chunks.push(value));output.on('end',()=>resolve(Buffer.concat(chunks)));output.on('error',reject);});
  const archive=archiver('zip',{zlib:{level:9}});archive.on('error',error=>output.destroy(error));archive.pipe(output);
  for(const entry of entries)archive.append(entry.content,{name:entry.name});await archive.finalize();return done;
}
it('Z a real high-ratio archive exceeds the per-entry decompression cap despite its small compressed size',async()=>{
  const bytes=await zip([{name:'large.js',content:Buffer.alloc(PLUGIN_MAX_ENTRY_SIZE+1)}]);expect(bytes.length).toBeLessThan(PLUGIN_MAX_ZIP_SIZE);
  expect(()=>readPluginZipEntries(bytes)).toThrow(expect.objectContaining({code:'PAYLOAD_TOO_LARGE'}));
  await expect(verifyPluginZip(bytes)).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE'});
});
it('Z a forged low uncompressed declaration cannot bypass the actual inflate output cap',async()=>{
  const bytes=await zip([{name:'large.js',content:Buffer.alloc(PLUGIN_MAX_ENTRY_SIZE+1)}]);
  const central=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));expect(central).toBeGreaterThan(0);bytes.writeUInt32LE(1,central+24);
  expect(()=>readPluginZipEntries(bytes)).toThrow(expect.objectContaining({code:'PAYLOAD_TOO_LARGE'}));
});
it('Z cumulative decompression is capped across individually allowed high-ratio entries',async()=>{
  const content=Buffer.alloc(Math.floor(PLUGIN_MAX_DECOMPRESSED_SIZE/3)+1), bytes=await zip([1,2,3].map(index=>({name:`entry${index}.js`,content})));
  expect(bytes.length).toBeLessThan(PLUGIN_MAX_ZIP_SIZE);expect(()=>readPluginZipEntries(bytes)).toThrow(expect.objectContaining({code:'PAYLOAD_TOO_LARGE'}));
});
it('Z excessive entry counts are rejected before decompression and normal archives still parse',async()=>{
  const bytes=await zip(Array.from({length:PLUGIN_MAX_ZIP_ENTRIES+1},(_,index)=>({name:`entry${index}.js`,content:Buffer.from('ok')})));
  expect(()=>readPluginZipEntries(bytes)).toThrow(expect.objectContaining({code:'PAYLOAD_TOO_LARGE'}));
  expect(readPluginZipEntries(await zip([{name:'index.js',content:Buffer.from('module.exports={};')}]))).toHaveLength(1);
});
