import {rehearsal} from './privacy-comparison.mjs';
if(process.argv.slice(2).join(' ')!=='--opt-in-synthetic-only')throw Error('Run only with --opt-in-synthetic-only; arbitrary inputs are unsupported');
console.log(JSON.stringify(rehearsal({optIn:true}),null,2));
