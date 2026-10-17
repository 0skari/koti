'use strict';
/*
 * Monte Carlo -työntekijä.
 * Saa: {id, pile, aiHand, humanCount, unknown, options, trials}
 *   options = lailliset siirrot (kortit) sekä tarvittaessa 'TSAKA' ja 'PICKUP'
 * Palauttaa: {id, scores, trials, best}
 *   scores = siirtojen pistesummat tämän työntekijän koemäärällä
 *   best   = tämän työntekijän osatuloksen paras siirtoindeksi
 * Pääsäie yhdistää osatulokset.
 */
const SUITS=['pa','ri','he','ru'];
const RANKS=['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const VALUE=Object.fromEntries(RANKS.map((r,i)=>[r,i]));
const PICTURES=['J','Q','K'];

function key(c){return c.r+c.s}
function shuffle(a){
 for(let i=a.length-1;i>0;i--){
  let j=Math.floor(Math.random()*(i+1));
  [a[i],a[j]]=[a[j],a[i]];
 }
 return a;
}
function isPicture(r){return PICTURES.includes(r)}
function fourOnTop(pile){
 return pile.length>=4&&pile.at(-1).r!=='2'&&pile.slice(-4).every(c=>c.r===pile.at(-1).r);
}
function burnReason(cards,oldTop,pile){
 if(fourOnTop(pile))return 'neljä samaa arvoa';
 if(cards.length!==1||!oldTop)return null;
 if(cards[0].r==='10'&&['3','4','5','6','7','8','9'].includes(oldTop.r))return 'kymppi';
 if(cards[0].r==='A'&&PICTURES.includes(oldTop.r))return 'ässä';
 return null;
}
function canPlay(cards,pile,hand,deckCount){
 if(!cards.length)return {ok:false,reason:'Valitse kortti.'};

 if(cards.some(c=>!hand.some(h=>key(h)===key(c))))
  return {ok:false,reason:'Kortti ei ole kädessä.'};

 if(cards.length>1&&(!cards.every(c=>c.r===cards[0].r)||cards.some(c=>['10','A'].includes(c.r))))
  return {ok:false,reason:'Vain samanarvoiset kortit voi pelata yhdessä; 10 ja A pelataan yksin.'};

 const t=pile.at(-1);

 if(!t){
  if(cards.some(c=>isPicture(c.r))&&deckCount>0)
   return {ok:false,reason:'Kuvakortin voi pelata tyhjään pöytään vasta nostopakan loputtua.'};
  return {ok:true};
 }

 if(t.r==='2'&&cards.some(c=>c.r!=='2'))
  return {ok:false,reason:'Kakkosen päälle voi pelata vain kakkosen.'};

 if(cards.some(c=>['10','A'].includes(c.r))){
  if(cards.length!==1)return {ok:false,reason:'Kympit ja ässät pelataan yksittäin.'};
  if(cards[0].r==='10'&&['3','4','5','6','7','8','9'].includes(t.r))return {ok:true};
  if(cards[0].r==='A'&&PICTURES.includes(t.r))return {ok:true};
  return {ok:false,reason:'Tämä kaatokortti ei kaada pinon päällimmäistä.'};
 }

 if(cards.some(c=>isPicture(c.r))){
  if(!['7','8','9','J','Q','K'].includes(t.r))
   return {ok:false,reason:'Kuvakortin voi pelata vain seiskan tai sallitun kuvakortin päälle.'};
  if(cards.some(c=>VALUE[c.r]<VALUE[t.r]))
   return {ok:false,reason:`Pelaa vähintään ${t.r} tai nosta pino.`};
  return {ok:true};
 }

 if(cards.every(c=>c.r==='2'||VALUE[c.r]>=VALUE[t.r]))return {ok:true};
 return {ok:false,reason:`Pelaa vähintään ${t.r} tai nosta pino.`};
}
function legalMoves(hand,pile,deckCount){
 const groups={};
 hand.forEach(c=>(groups[c.r]??=[]).push(c));
 const moves=[];

 for(const [r,cs] of Object.entries(groups)){
  for(const c of cs){
   if(canPlay([c],pile,hand,deckCount).ok)moves.push([c]);
  }
  if(cs.length>1&&!['10','A'].includes(r)){
   if(canPlay(cs,pile,hand,deckCount).ok)moves.push(cs.slice());
   if(cs.length===4){
    const smaller=cs.slice(0,3);
    if(canPlay(smaller,pile,hand,deckCount).ok)moves.push(smaller);
   }
  }
 }

 const seen=new Set();
 return moves.filter(m=>{
  const k=m.map(key).sort().join(',');
  if(seen.has(k))return false;
  seen.add(k);
  return true;
 });
}

/* Simulaatioiden säännöt vastaavat varsinaista peliä. */
function simOnce(candidate,ctx){
 const pool=shuffle(ctx.unknown.map(c=>({...c})));
 const sim={
  hands:[pool.splice(0,ctx.humanCount),ctx.aiHand.map(c=>({...c}))],
  deck:pool,
  pile:ctx.pile.map(c=>({...c})),
  turn:1,forced:false
 };
 function refillS(p){
  while(sim.hands[p].length<5&&sim.deck.length)
   sim.hands[p].push(sim.deck.pop());
 }
 function applyS(p,cs){
  const old=sim.pile.at(-1),empty=!sim.pile.length;
  cs.forEach(c=>{
   const i=sim.hands[p].findIndex(x=>key(x)===key(c));
   if(i>=0)sim.hands[p].splice(i,1);
   sim.pile.push(c);
  });
  const reason=burnReason(cs,old,sim.pile);
  if(reason){
   sim.pile=[];
   sim.turn=p;
   sim.forced=false;
   refillS(p);
  }else if(empty&&cs.length===1&&['10','A'].includes(cs[0].r)){
   sim.forced=true;
   sim.turn=1-p;
   refillS(p);
  }else{
   sim.turn=1-p;
   sim.forced=false;
   refillS(p);
  }
 }
 if(candidate==='TSAKA'){
  // Tsäkä: botti nostaa nostopakan päällimmäisen kortin ja pelaa sen, jos se sopii.
  // Simuloitu pakka on satunnaisjärjestyksessä, joten botti ei "näe" oikeaa korttia.
  const c=sim.deck.pop();
  sim.hands[1].push(c);
  if(canPlay([c],sim.pile,sim.hands[1],sim.deck.length).ok){
   applyS(1,[c]);
  }else{
   if(sim.pile.length)sim.hands[1].push(...sim.pile);
   sim.pile=[];
   sim.forced=false;
   sim.turn=0;
   refillS(1);
  }
 }else if(candidate==='PICKUP'){
  sim.hands[1].push(...sim.pile);
  sim.pile=[];
  sim.forced=false;
  sim.turn=0;
  refillS(0);
 }else{
  const simCandidate=candidate
   .map(c=>sim.hands[1].find(x=>key(x)===key(c)))
   .filter(Boolean);
  applyS(1,simCandidate);
 }

 for(let step=0;step<100;step++){
  if(!sim.deck.length&&sim.hands.some(h=>!h.length))break;

  if(sim.forced){
   sim.hands[sim.turn].push(...sim.pile);
   sim.pile=[];
   sim.forced=false;
   sim.turn=1-sim.turn;
   refillS(sim.turn);
   continue;
  }

  const p=sim.turn,hand=sim.hands[p];
  const moves=legalMoves(hand,sim.pile,sim.deck.length);

  if(!moves.length){
   if(sim.pile.length){
    hand.push(...sim.pile);
    sim.pile=[];
   }
   sim.turn=1-p;
   refillS(sim.turn);
   continue;
  }

  if(sim.pile.length&&Math.random()<.1){
   hand.push(...sim.pile);
   sim.pile=[];
   sim.turn=1-p;
   refillS(sim.turn);
   continue;
  }

  applyS(p,moves[Math.floor(Math.random()*moves.length)]);
 }

 if(!sim.deck.length&&sim.hands[1].length===0&&sim.hands[0].length!==0)return 1;
 if(!sim.deck.length&&sim.hands[0].length===0&&sim.hands[1].length!==0)return 0;
 return Math.max(0,Math.min(1,.5+(sim.hands[0].length-sim.hands[1].length)*.035));
}

self.onmessage=e=>{
 const {id,pile,aiHand,humanCount,unknown,options,trials}=e.data;
 const ctx={pile,aiHand,humanCount,unknown};
 const scores=options.map(()=>0);
 let best=0,bestScore=-Infinity;

 for(let i=0;i<options.length;i++){
  let s=0;
  for(let n=0;n<trials;n++)s+=simOnce(options[i],ctx);
  scores[i]=s;
  if(s>bestScore){bestScore=s;best=i}
 }
 self.postMessage({id,scores,trials,best});
};