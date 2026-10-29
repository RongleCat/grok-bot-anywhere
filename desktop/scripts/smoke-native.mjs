import {NativeCompanion} from '../src/main/companion.mjs';
import {normalizeBot} from 'grok-bot-sdk';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const bot=normalizeBot({agentId:'00000000-0000-4000-8000-000000000000',name:'Native smoke',avatarShape:'cloud',avatarColor:'brown'});
const companion=new NativeCompanion({executable:root+'native/GrokBotCompanion.app/Contents/MacOS/TouchBarBot',avatarRoot:root+'out/native-avatar',smoke:true,onRequest:async()=>({})});
try{
 await companion.start();
 await companion.call('state',{connected:true,bots:[bot],runtime:{mainAgentId:bot.id,statuses:[]},inbox:[]});
 await companion.call('composer.open',{botId:bot.id,receipt:{id:'one',text:'Native input context',files:[]}});
 await assert.rejects(companion.call('composer.open',{botId:bot.id,receipt:{id:'two',text:'Do not overwrite',files:[]}}),/DRAFT_BUSY/);
 await companion.call('composer.hide',{});
 console.log('Native companion smoke passed: shared roster, native composer, draft protection, hide. No network or sends.');
}finally{companion.stop();}
