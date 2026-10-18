const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const Module=require('node:module');
const file=path.resolve(process.cwd(),'src/theme.ts');
const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const theme=new Module(file,module);theme._compile(compiled,file);
test('VAT amounts retain haléře while whole-crown labels stay compact',()=>{
 assert.equal(theme.exports.fmtCZK(9873.6),'9 873,60 Kč');
 assert.equal(theme.exports.fmtCZK(1713.6),'1 713,60 Kč');
 assert.equal(theme.exports.fmtCZK(4232.58),'4 232,58 Kč');
 assert.equal(theme.exports.fmtCZK(1000),'1 000 Kč');
 assert.equal(theme.exports.fmtCZK(undefined),'0 Kč');
});
