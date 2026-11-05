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

# shrink the skin patch vertically so it covers moustache+lips only (keeps the nose visible)
def _fix_patch(mm):
    t,h=float(mm.group(2)),float(mm.group(4)); c=t+h/2; nh=h*0.62; nt=c+h*0.04-nh/2
    return f'{mm.group(1)}{nt:.3f}%;width:{mm.group(3)}%;height:{nh:.3f}%;'
if 'patch-fixed' not in s:
    s=re.sub(r'(<i class="mpatch" style="left:[\d.]+%;top:)([\d.]+)%;width:([\d.]+)%;height:([\d.]+)%;',_fix_patch,s)
    s=s.replace('</head>','<meta name="patch-fixed" content="1"></head>',1)
open(p,'w').write(s); print('patched avatar',n)
