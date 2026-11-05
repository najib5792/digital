# post-build patch for the full-body Najib mascot pack (run after build.py)
import re, sys, json
p=sys.argv[1]; pack=sys.argv[2]
s=open(p).read()
css='<style id="fullbody-mascot">.port #mascot{right:-40px !important;bottom:0 !important;width:620px !important;height:880px !important}</style>'
if 'fullbody-mascot' not in s: s=s.replace('</head>',css+'</head>',1)
m=json.load(open(pack+'/mascot.json')); pose=m.get('avatar_pose','wave')
from PIL import Image
W,H=Image.open(f"{pack}/{m['poses'][pose]}").size
cx=m['anchor'][pose][0]; sc=84/330; left=42-cx*sc; top=42-175*sc
pat=re.compile(r'(<img src="assets/mascot/'+re.escape(m['poses'][pose])+r'" style="position:absolute;max-width:none;)[^"]*(")')
s,n=pat.subn(lambda mm: mm.group(1)+f'width:{W*sc:.1f}px;height:{H*sc:.1f}px;left:{left:.1f}px;top:{top:.1f}px;margin:0'+mm.group(2),s)
open(p,'w').write(s); print('patched avatar',n)
