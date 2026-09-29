import json,re
import os,sys
HERE=os.path.dirname(os.path.abspath(__file__))
SPEC=os.path.join(HERE,'..','..','specs','02-combat-core-balance-sim-spec.md')
s=open(SPEC).read()
def table(h):
    i=s.index(h); lines=s[i:].split('\n')
    rows=[];started=False
    for l in lines[1:]:
        if l.startswith('|'):
            started=True; rows.append([c.strip() for c in l.strip().strip('|').split('|')])
        elif started: break
        elif l.strip()=='' : continue
    return rows[2:]
SK=['hp','atk','def','mag','spd','luck']
st=lambda x:dict(zip(SK,[int(v) for v in x.split('/')]))
tid=lambda x:x.strip('`')
nul=lambda x:None if x=='null' else x
R={'v':1}
cl={}
for r in table('##### Classes'):
    b=[int(v) for v in r[7].split('/')]
    cl[tid(r[0])]={'id':tid(r[0]),'kind':r[2],'parents':None if r[3]=='—' else r[3].split(' + '),'statBp':st(r[4]),'bagSize':int(r[5]),'switchFee':int(r[6]),'passives':[],'starter':None,'aiBias':dict(zip(['attack','strike','spell','guard','counter','ward'],b))}
for r in [x for x in table('Passives (rank') if x[0].startswith('`')]:
    c=tid(r[0])
    for k,cell in enumerate(r[1:6]):
        m=re.match(r'`([^`]+)` "[^"]+" \S+ `([^`]+)` (-?\d+)',cell)
        cl[c]['passives'].append({'rank':k+1,'id':m.group(1),'hook':m.group(2),'value':int(m.group(3))})
for r in [x for x in table('Starter loadouts') if x[0].startswith('`')]:
    cl[tid(r[0])]['starter']={'weapon':nul(r[1]),'shield':nul(r[2]),'accessory':nul(r[3]),'battleSpell':nul(r[4]),'wardSpell':nul(r[5]),'bag':json.loads(r[6])}
R['classes']=cl
g={}
for r in table('##### Gear'):
    stats={k:0 for k in SK}
    if r[5]!='—':
        for part in r[5].split(', '):
            k,v=part.split(' '); stats[k]=int(v)
    hooks=[] if r[6]=='—' else [{'hook':h.split('` ')[0].strip('`'),'value':int(h.split('` ')[1])} for h in r[6].split(', ')]
    g[tid(r[0])]={'id':tid(r[0]),'slot':r[2],'tier':int(r[3]),'price':int(r[4]),'stats':stats,'hooks':hooks}
R['gear']=g
R['items']={tid(r[0]):{'id':tid(r[0]),'kind':r[2],'price':int(r[3]),'use':r[4],'effect':json.loads(r[5].strip('`'))} for r in table('##### Items')}
R['battleSpells']={tid(r[0]):{'id':tid(r[0]),'tier':int(r[2]),'price':int(r[3]),'powerBp':int(r[4]),'effect':json.loads(r[5].strip('`'))} for r in table('##### Battle spells')}
R['wardSpells']={tid(r[0]):{'id':tid(r[0]),'tier':int(r[2]),'price':int(r[3]),'mode':r[4],'valueBp':int(r[5])} for r in table('##### Ward spells')}
R['fieldSpells']={tid(r[0]):{'id':tid(r[0]),'tier':int(r[2]),'price':int(r[3]),'tag':r[4],'value':int(r[5]),'duration':int(r[6])} for r in table('##### Field spells')}
R['npcCurve']=[dict(zip(SK,[int(v) for v in r[1:7]])) for r in table('##### NPC stat curve')]
AT=lambda x:dict(zip(['attack','strike','spell','flee'],[int(v) for v in x.split('/')]))
DT=lambda x:dict(zip(['guard','counter','ward'],[int(v) for v in x.split('/')]))
HK=lambda x:[] if x=='—' else [{'hook':h.split('` ')[0].strip('`'),'value':int(h.split('` ')[1])} for h in x.split(', ')]
R['monsters']={tid(r[0]):{'id':tid(r[0]),'tier':int(r[2]),'zone':r[3],'statBp':st(r[4]),'attackTable':AT(r[5]),'defendTable':DT(r[6]),'battleSpell':nul(r[7]),'wardSpell':nul(r[8]),'hooks':HK(r[9]),'xp':int(r[10]),'gold':int(r[11])} for r in table('##### Monsters')}
gu={}
for r in table('##### Guardians'):
    base={'statBp':st(r[3]),'attackTable':AT(r[4]),'defendTable':DT(r[5]),'battleSpell':nul(r[6]),'wardSpell':nul(r[7]),'hooks':[]}
    if tid(r[0])=='crown-enforcer': R['enforcer']={'id':'crown-enforcer',**base,'xpPerLevel':int(r[8]),'goldPerLevel':int(r[9])}
    else: gu[tid(r[0])]={'id':tid(r[0]),'style':r[2],**base,'xpPerTier':int(r[8]),'goldPerTier':int(r[9])}
R['guardians']=gu
i=s.index('##### Tuning');j=s.index('```json',i)+7;k=s.index('```',j)
t=json.loads(s[j:k]); R['combat']=t['combat'];R['progression']=t['progression'];R['economy']=t['economy']
json.dump(R,open(os.path.join(HERE,'spec-rules.json'),'w'))
