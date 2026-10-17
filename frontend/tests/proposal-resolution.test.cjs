const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the real handler with an isolated API and native-dialog boundary.
const filename = 'app/zakazka/[id].tsx';
const source = fs.readFileSync(filename, 'utf8');
const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'resolveProposal') handler = node;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(handler, 'proposal handler must exist');
const code = ts.transpileModule(handler.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function setup(platform) {
  const requests = [], alerts = [], prompts = [], jobs = [];
  const context = vm.createContext({
    id: 'job-1', Platform: { OS: platform },
    Alert: { alert: (...args) => alerts.push(args), prompt: (...args) => prompts.push(args) },
    api: { post: async (...args) => { requests.push(args); return { data: { id: 'job-1' } }; } },
    setJob: job => jobs.push(job), getApiErrorMessage: err => err.message,
  });
  vm.runInContext(code, context);
  return { context, requests, alerts, prompts, jobs };
}
for (const platform of ['android', 'web']) {
  test(`${platform}: approval waits for confirmation and never calls iOS prompt`, async () => {
    const s = setup(platform);
    await s.context.resolveProposal('proposal-1', 'approve');
    assert.equal(s.prompts.length, 0);
    assert.equal(s.requests.length, 0);
    const buttons = s.alerts[0][2];
    assert.equal(buttons[0].style, 'cancel');
    assert.equal(buttons[0].onPress, undefined);
    await buttons[1].onPress();
    assert.equal(s.requests[0][0], '/jobs/job-1/proposals/proposal-1/resolve');
    assert.equal(s.requests[0][1].action, 'approve');
    assert.equal(s.requests[0][1].cena, 0);
    assert.equal(s.jobs.length, 1);
  });
}
test('iOS: approval waits for the entered unit price', async () => {
  const s = setup('ios');
  await s.context.resolveProposal('proposal-1', 'approve');
  assert.equal(s.requests.length, 0);
  assert.equal(s.alerts.length, 0);
  await s.prompts[0][2]('125.50');
  assert.equal(s.requests[0][1].cena, 125.5);
});
test('rejection preserves the existing API contract', async () => {
  const s = setup('android');
  await s.context.resolveProposal('proposal-1', 'reject');
  assert.equal(s.requests[0][1].action, 'reject');
  assert.equal(s.requests[0][1].cena, 0);
  assert.equal(s.prompts.length, 0);
  assert.equal(s.alerts.length, 0);
});
