import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown} from '../src/renderer/markdown.mjs';

test('markdown renders common Bot instruction blocks',()=>{
  const html=renderMarkdown('# Rules\n\n- one\n- **two**\n\n```js\nconst x = `a`;\n```\n\n> note');
  assert.match(html,/^<h1>Rules<\/h1>/);
  assert.match(html,/<ul><li>one<\/li><li><strong>two<\/strong><\/li><\/ul>/);
  assert.match(html,/<pre><code class="language-js">const x = `a`;<\/code><\/pre>/);
  assert.match(html,/<blockquote>note<\/blockquote>/);
});

test('markdown escapes HTML and only allows safe links',()=>{
  const html=renderMarkdown('<script>alert(1)</script>\n\n[ok](https://example.com/a?b=1&c=2) [bad](javascript:alert(1))');
  assert.equal(html.includes('<script>'),false);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/href="https:\/\/example.com\/a\?b=1&amp;c=2"/);
  assert.equal(html.includes('href="javascript:'),false);
  assert.match(html,/bad/);
});

test('markdown keeps line breaks and italic text readable',()=>{
  const html=renderMarkdown('first\nsecond *soft*');
  assert.match(html,/<p>first<br>second <em>soft<\/em><\/p>/);
});
