ARG BASE_IMAGE=crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/shop:imagic-0.2.2-mvp-auth-credits-amd64-v8
FROM ${BASE_IMAGE}

USER root

RUN node <<'NODE'
const fs = require('fs');

const files = [
  '/app/apps/shop/.next/static/chunks/bb76a6227109cd60.js',
  '/app/apps/shop/.next/server/chunks/ssr/_4608cccd._.js',
];

const replacements = [
  ['children:["Buy credits",', 'children:["Get credits",'],
  [
    'title:"Buy credits for image + magic = imagic.",body:"Credits power generation runs. Start with free trial credits after sign-up, then top up when you need more campaign-ready visuals."',
    'title:"Get credits for image + magic = imagic.",body:"Credits power generation runs. New accounts receive free trial credits; MVP credit packs can be claimed once while Stripe checkout is being connected."',
  ],
  ['l?"Top up credits":"Sign in to buy"', 'l?"Get credits":"Sign in to continue"'],
  ['i?"Top up credits":"Sign in to buy"', 'i?"Get credits":"Sign in to continue"'],
  [
    'let t=await ew(`/credit-packs/${e.id}/checkout`,{method:"POST"});i(t),o({phase:"success",message:`${e.credits} credits added. Balance is now ${t.balance}.`})',
    'let t=await ew(`/credit-packs/${e.id}/checkout`,{method:"POST"});i(t);if(t.checkoutUrl){window.location.href=t.checkoutUrl;return}let a="number"==typeof t.addedCredits?t.addedCredits:e.credits;o({phase:"success",message:t.alreadyGranted||a<=0?`This MVP credit grant was already claimed. Balance remains ${t.balance}.`:`${a} credits added. Balance is now ${t.balance}.`})',
  ],
  [
    'let b=await av(`/credit-packs/${a.id}/checkout`,{method:"POST"});f(b),h({phase:"success",message:`${a.credits} credits added. Balance is now ${b.balance}.`})',
    'let b=await av(`/credit-packs/${a.id}/checkout`,{method:"POST"});f(b);if(b.checkoutUrl){window.location.href=b.checkoutUrl;return}let l="number"==typeof b.addedCredits?b.addedCredits:a.credits;h({phase:"success",message:b.alreadyGranted||l<=0?`This MVP credit grant was already claimed. Balance remains ${b.balance}.`:`${l} credits added. Balance is now ${b.balance}.`})',
  ],
];

let applied = 0;
for (const file of files) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    const occurrences = source.split(from).length - 1;
    if (occurrences > 0) {
      source = source.replaceAll(from, to);
      applied += occurrences;
    }
  }
  fs.writeFileSync(file, source);
}

if (applied < 8) {
  throw new Error(`Expected at least 8 bundle replacements, applied ${applied}`);
}
NODE

USER nextjs
