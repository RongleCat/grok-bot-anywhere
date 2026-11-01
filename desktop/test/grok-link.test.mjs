import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grokBotAgentUrl} from '../src/grok-link.mjs';

test('a Grok Bot link is the agent route plus the bot id',()=>{
  assert.equal(grokBotAgentUrl('8af96826-d4c8-40b7-acc9-81dadb06e508'),'grokbot://app/v1/agent?id=8af96826-d4c8-40b7-acc9-81dadb06e508');
  assert.throws(()=>grokBotAgentUrl('id?x=1'),/BOT_NOT_FOUND/);
  assert.throws(()=>grokBotAgentUrl(''),/BOT_NOT_FOUND/);
});
