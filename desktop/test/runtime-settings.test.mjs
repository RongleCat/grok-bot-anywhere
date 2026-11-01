import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sidebarFromSettings} from '../src/service/runtime-settings.mjs';

test('sidebar settings keep pins and sections and drop unexpected fields',()=>{
  const result=sidebarFromSettings({
    mainAgentId:'main-1',
    pinnedAgents:{agentIds:['pin-1','pin-1','bad id']},
    sidebarSections:{sections:[
      {id:'sec-1',name:'工作',agentIds:['pin-1','bot-a'],isCollapsed:true},
      {id:'sec-1',name:'dup'},
      {name:'missing'},
      {id:'sec-2'}
    ]},
    unexpectedSecret:'hidden'
  });
  assert.deepEqual(result,{
    mainAgentId:'main-1',
    pinnedAgentIds:['pin-1'],
    sections:[
      {id:'sec-1',name:'工作',agentIds:['pin-1','bot-a'],collapsed:true},
      {id:'sec-2',name:'',agentIds:[],collapsed:false}
    ]
  });
  assert.ok(!JSON.stringify(result).includes('hidden'));
  assert.deepEqual(sidebarFromSettings(undefined),{mainAgentId:null,pinnedAgentIds:[],sections:[]});
});
