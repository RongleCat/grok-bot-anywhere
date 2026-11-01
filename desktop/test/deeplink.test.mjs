import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {composeLink,deeplinkNotice,parseDeeplink,shortcutSourceAllowed,TEXT_LIMIT} from '../src/shell/deeplink.mjs';
import {coalBallGeometry,coalBallSample,coalBallTemplatePng,trayIconImages} from '../src/shell/coal-ball.mjs';

test('a Windows share link carries only a batch id',()=>{
  const batch='7f9104b344314cd7be8836ab7076ab14';
  const parsed=parseDeeplink(`grokbotanywhere://share?batch=${batch}`);
  assert.deepEqual(parsed,{ok:true,action:'share',batch,bot:null,text:'',hasText:false});
  // The Bot is chosen in the app, so a link that names one is not a share.
  assert.equal(parseDeeplink(`grokbotanywhere://share?batch=${batch}&bot=x`).ok,false);
  assert.equal(parseDeeplink('grokbotanywhere://share').ok,false);
  assert.equal(parseDeeplink('grokbotanywhere://share?batch=..%2F..%2Fetc').ok,false);
  assert.equal(parseDeeplink(`grokbotanywhere://share?batch=${batch}&token=secret`).ok,false);
});

test('deeplink accepts the three routes and ignores unknown parameters',()=>{
  assert.deepEqual(parseDeeplink('grokbotanywhere://open'),{ok:true,action:'open',bot:null,text:'',hasText:false});
  const compose=parseDeeplink('grokbotanywhere://compose?bot=bot_1&text=hello%20there&extra=1');
  assert.equal(compose.ok,true);
  assert.equal(compose.action,'compose');
  assert.equal(compose.bot,'bot_1');
  assert.equal(compose.text,'hello there');
  assert.equal(compose.hasText,true);
  const omitted=parseDeeplink('grokbotanywhere://compose');
  assert.equal(omitted.ok,true);
  assert.equal(omitted.bot,null);
  assert.equal(omitted.hasText,false);
  const send=parseDeeplink('grokbotanywhere://send?bot=x&text=hi');
  assert.equal(send.ok,true);
  assert.equal(send.action,'send');
  assert.equal(send.bot,'x');
  assert.equal(send.text,'hi');
  assert.equal(parseDeeplink(`grokbotanywhere://compose?text=${'a'.repeat(TEXT_LIMIT)}`).ok,true);
});

test('deeplink rejects tokens, overlong text, unknown routes, and bad bot ids',()=>{
  assert.equal(parseDeeplink('grokbotanywhere://send?bot=x&text=hi&token=abc').ok,false);
  assert.equal(parseDeeplink('grokbotanywhere://send?bot=x&text=hi&token=abc').reason,'token');
  assert.equal(parseDeeplink('grokbotanywhere://send?bot=x&text=hi&access_token=abc').reason,'token');
  assert.equal(parseDeeplink('grokbotanywhere://open?refresh-token=abc').reason,'token');
  assert.equal(parseDeeplink('grokbotanywhere://user:secret@open').reason,'token');
  assert.equal(parseDeeplink(`grokbotanywhere://send?bot=x&text=${'a'.repeat(TEXT_LIMIT+1)}`).reason,'text');
  assert.equal(parseDeeplink('grokbotanywhere://settings').reason,'host');
  assert.equal(parseDeeplink('grokbotanywhere://open/extra').reason,'path');
  assert.equal(parseDeeplink('https://example.com/open').reason,'scheme');
  assert.equal(parseDeeplink('not a url').reason,'invalid');
  assert.equal(parseDeeplink('grokbotanywhere://send?text=hi').reason,'bot');
  assert.equal(parseDeeplink('grokbotanywhere://send?bot=bad%20id&text=hi').reason,'bot');
  assert.equal(parseDeeplink(`grokbotanywhere://compose?bot=${'a'.repeat(129)}`).reason,'bot');
  assert.equal(parseDeeplink('grokbotanywhere://compose?bot=ok-id_1').ok,true);
});

test('compose link round-trips and send follows the shortcuts source switch',()=>{
  const link=composeLink('bot-a');
  assert.equal(link,'grokbotanywhere://compose?bot=bot-a');
  assert.equal(parseDeeplink(link).bot,'bot-a');
  assert.equal(composeLink('bad id'),null);
  assert.equal(shortcutSourceAllowed({enabled:true,sources:{shortcuts:true,drop:false,share:false,wechat:false}}),true);
  assert.equal(shortcutSourceAllowed({enabled:true,sources:{shortcuts:false,drop:true,share:true,wechat:true}}),false);
  assert.equal(shortcutSourceAllowed({enabled:false,sources:{shortcuts:true}}),false);
  assert.equal(shortcutSourceAllowed(null),false);
  assert.match(deeplinkNotice('zh-CN','SOURCE_DISABLED'),/打开接收/);
  assert.match(deeplinkNotice('en','LOGIN_REQUIRED'),/Sign in/);
  assert.match(deeplinkNotice('en','BOT_NOT_FOUND'),/not found/);
  assert.match(deeplinkNotice('zh','RECEIPT_EMPTY'),/先写一点内容/);
  assert.equal(deeplinkNotice('zh-CN','DEEPLINK_IGNORED'),'这个链接没有执行。');
  assert.equal(deeplinkNotice('en','DEEPLINK_IGNORED'),'This link did not run.');
});

test('main process registers the protocol and reads open-url plus second-instance',async()=>{
  const main=await readFile(fileURLToPath(new URL('../src/main/main.mjs',import.meta.url)),'utf8');
  assert.match(main,/setAsDefaultProtocolClient\('grokbotanywhere'/);
  assert.match(main,/app\.isPackaged\)app\.setAsDefaultProtocolClient\('grokbotanywhere'\)/);
  assert.match(main,/setAsDefaultProtocolClient\('grokbotanywhere',process\.execPath,\[app\.getAppPath\(\)\]\)/);
  assert.match(main,/if\(!preview\)\{[\s\S]*setAsDefaultProtocolClient\('grokbotanywhere'/);
  const openAt=main.indexOf("app.on('open-url'");
  const secondAt=main.indexOf("app.on('second-instance'");
  assert.ok(openAt>0&&secondAt>0);
  assert.match(main.slice(openAt,openAt+400),/grokbotanywhere:/);
  assert.match(main.slice(secondAt,secondAt+700),/grokbotanywhere:\/\//);
  assert.match(main,/parseExplorerForward\(argv/);
  assert.match(main,/explorerBatch\.push\(forward\)/);
});

function pngPixels(png){
  let offset=8,idat=Buffer.alloc(0);
  while(offset+8<=png.length){
    const length=png.readUInt32BE(offset);
    const type=png.subarray(offset+4,offset+8).toString('ascii');
    const data=png.subarray(offset+8,offset+8+length);
    if(type==='IDAT')idat=Buffer.concat([idat,data]);
    offset+=12+length;
    if(type==='IEND')break;
  }
  return inflateSync(idat);
}

test('menu bar template leaves the eyes transparent and the ball opaque',()=>{
  const mac=trayIconImages('darwin');
  assert.deepEqual(mac.map(item=>[item.size,item.scale,item.template]),[[18,1,true],[36,2,true]]);
  const win=trayIconImages('win32');
  assert.deepEqual(win.map(item=>[item.size,item.scale,item.template]),[[16,1,false],[32,2,false]]);
  for(const icon of mac){
    const raw=pngPixels(icon.png);
    const stride=1+icon.size*4;
    assert.equal(raw.length,icon.size*stride);
    const at=(x,y)=>raw.subarray(y*stride+1+x*4,y*stride+1+x*4+4);
    let punched=0,opaque=0;
    for(let y=0;y<icon.size;y++)for(let x=0;x<icon.size;x++){
      const kinds=new Set();
      for(const [ox,oy] of [0.125,0.375,0.625,0.875].flatMap(ox=>[0.125,0.375,0.625,0.875].map(oy=>[ox,oy])))kinds.add(coalBallSample(icon.size,x+ox,y+oy));
      if(kinds.size!==1)continue;
      const kind=[...kinds][0],pixel=at(x,y);
      if(kind==='out')assert.equal(pixel[3],0);
      if(kind==='eye'){assert.equal(pixel[3],0);punched++;}
      if(kind==='body'){assert.deepEqual([...pixel],[0,0,0,255]);opaque++;}
    }
    assert.ok(punched>0);
    assert.ok(opaque>0);
  }
});
