import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchShareTitles,spliceWechatOrder} from '../src/share/order.mjs';

test('share titles map onto bot ids once, in sheet order',()=>{
  const entries=[{botId:'a',botName:'知识管理员'},{botId:'b',botName:'赛博小晚'},{botId:'c',botName:'知识管理员'}];
  assert.deepEqual(matchShareTitles(['Mail','发给 知识管理员','发给 赛博小晚','发给 知识管理员','Notes'],entries),['a','b','c']);
  assert.deepEqual(matchShareTitles(['Send to 赛博小晚'],entries),['b']);
  assert.deepEqual(matchShareTitles(['发给 没有这个 Bot'],entries),[]);
});

test('menu sort replaces only the wechat positions',()=>{
  assert.deepEqual(spliceWechatOrder(['a','b','c','d'],['a','c'],['c','a']),['c','b','a','d']);
  assert.deepEqual(spliceWechatOrder(['a','b','c'],['a','c'],['c']),['c','b','a']);
  assert.deepEqual(spliceWechatOrder(['a','b'],['a'],['missing','a']),['a','b']);
});
