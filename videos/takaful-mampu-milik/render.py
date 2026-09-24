import numpy as np, cv2, math, random, subprocess, sys, imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from elems import E
FPS=30; DUR=20; N=FPS*DUR
src=Image.open('src.jpg').convert('RGB'); base=Image.open('base.png').convert('RGB')
W,H=src.size
S=np.asarray(src).astype(np.float32); B=np.asarray(base).astype(np.float32)
L={}
for k,(a,b,c,d) in E.items():
    diff=np.abs(S[b:d,a:c]-B[b:d,a:c]).max(-1)
    al=np.clip((diff-10)/30,0,1)
    al=cv2.GaussianBlur(al,(0,0),1.2)
    # feather the rect edge
    h,w=al.shape; f=np.ones_like(al); e=6
    ry=np.minimum(np.arange(h),np.arange(h)[::-1]); rx=np.minimum(np.arange(w),np.arange(w)[::-1])
    f=np.clip(np.minimum(ry[:,None],rx[None,:])/e,0,1)
    al=al*f
    if k=='title': al[165-b:,468-a:612-a]=0
    rgba=np.dstack([S[b:d,a:c],al*255]).astype(np.uint8)
    L[k]=Image.fromarray(rgba,'RGBA')
def clamp(x): return max(0.0,min(1.0,x))
def eo(x): x=clamp(x); return 1-(1-x)**3
def eback(x,s=1.9):
    x=clamp(x); x-=1; return x*x*((s+1)*x+s)+1
def eelastic(x):
    x=clamp(x)
    if x in (0,1): return x
    return 2**(-10*x)*math.sin((x*10-0.75)*2*math.pi/3)+1
def prog(t,t0,d): return clamp((t-t0)/d)
def put(fr,k,scale=1.0,dx=0,dy=0,alpha=1.0,rot=0.0,origin=None):
    if alpha<=0.003 or scale<=0.01: return
    im=L[k]; a,b,c,d=E[k]; w,h=im.size
    ox,oy=origin if origin else ((a+c)/2,(b+d)/2)
    if abs(scale-1)>1e-3 or abs(rot)>1e-3:
        nw,nh=max(1,int(w*scale)),max(1,int(h*scale))
        im2=im.resize((nw,nh),Image.BICUBIC)
        nx=ox+(a-ox)*scale; ny=oy+(b-oy)*scale
        if abs(rot)>1e-3:
            cx,cy=nx+nw/2,ny+nh/2
            im2=im2.rotate(rot,Image.BICUBIC,expand=True)
            nx,ny=cx-im2.size[0]/2,cy-im2.size[1]/2
    else: im2=im; nx,ny=a,b
    if alpha<1:
        r,g,bb,al=im2.split(); al=al.point(lambda v:int(v*alpha)); im2=Image.merge('RGBA',(r,g,bb,al))
    fr.alpha_composite(im2,(int(round(nx+dx)),int(round(ny+dy))))
def shine(fr,k,p):
    if p<=0 or p>=1: return
    a,b,c,d=E[k]; w,h=c-a,d-b
    al=np.asarray(L[k])[...,3].astype(np.float32)/255
    yy,xx=np.mgrid[0:h,0:w]
    pos=-0.3*w+p*(1.6*w)
    band=np.exp(-((xx+0.5*yy-pos)/(0.06*w))**2)*0.65
    ov=np.zeros((h,w,4),np.uint8); ov[...,:3]=255; ov[...,3]=(band*al*255).astype(np.uint8)
    fr.alpha_composite(Image.fromarray(ov,'RGBA'),(a,b))
def star(dr,x,y,r,a):
    col=(255,255,240,int(255*a))
    dr.polygon([(x,y-r),(x+r*0.22,y-r*0.22),(x+r,y),(x+r*0.22,y+r*0.22),(x,y+r),(x-r*0.22,y+r*0.22),(x-r,y),(x-r*0.22,y-r*0.22)],fill=col)
random.seed(7)
STARS=[(random.uniform(20,W-20),random.choice([random.uniform(20,400),random.uniform(1090,1330)]),random.uniform(6,14),random.uniform(0,20),random.uniform(1.2,2.2)) for _ in range(22)]
# confetti burst for price tags
def burst(dr,cx,cy,p,seed):
    if p<=0 or p>=1: return
    rnd=random.Random(seed)
    for i in range(26):
        ang=rnd.uniform(0,2*math.pi); sp=rnd.uniform(90,240)
        x=cx+math.cos(ang)*sp*eo(p); y=cy+math.sin(ang)*sp*eo(p)+120*p*p
        col=rnd.choice([(255,215,0),(255,255,255),(255,120,40),(230,30,50)])
        s=rnd.uniform(4,8)*(1-p*0.5)
        dr.rectangle([x-s/2,y-s/2,x+s/2,y+s/2],fill=col+(int(255*(1-p)),))
def frame(i):
    t=i/FPS
    fr=base.convert('RGBA')
    # --- top ---
    p=prog(t,0.3,0.7)
    if p>0: put(fr,'title',scale=1+1.4*(1-eback(p,1.4)),alpha=clamp(p*3))
    pt=prog(t,1.1,0.6)
    bob=math.sin((t-1.7)*2.4)*4 if t>1.7 else 0
    if pt>0: put(fr,'char1',dy=320*(1-eback(pt))+bob,alpha=clamp(pt*4))
    put(fr,'bangjib',dx=-60*(1-eo(prog(t,1.6,0.5))),alpha=prog(t,1.6,0.5))
    pb=prog(t,2.0,0.6)
    if pb>0:
        br=1+0.03*math.sin((t-2.6)*4) if t>2.6 else 1
        put(fr,'bubble',scale=eelastic(pb)*br,origin=(650,300))
    # --- hibah panel ---
    pg=prog(t,2.8,0.6)
    if pg>0: put(fr,'gift',scale=eback(pg)*(1+0.02*math.sin(t*3)),origin=(225,660))
    put(fr,'hibah_t',dx=-80*(1-eo(prog(t,3.2,0.5))),alpha=prog(t,3.2,0.4))
    for j,k in enumerate(['heart','wheel','car','crash']):
        pp=prog(t,3.6+0.35*j,0.5)
        if pp<=0: continue
        sc=eback(pp)
        if k=='heart' and t>6: sc*=1+0.06*max(0,math.sin(t*6))**8
        put(fr,k,scale=sc,dy=40*(1-eo(pp)))
    # arrow wipe
    pa=prog(t,5.1,0.45)
    if pa>0:
        a,b,c,d=E['arrow1']; im=L['arrow1']; w=int((c-a)*eo(pa))
        if w>0: fr.alpha_composite(im.crop((0,0,w,d-b)),(a,b))
    p1=prog(t,5.4,0.7)
    if p1>0:
        pulse=1+0.04*math.sin((t-6.1)*5) if t>6.1 else 1
        put(fr,'tag1',dx=500*(1-eback(p1)),scale=pulse,alpha=clamp(p1*3))
        shine(fr,'tag1',((t-6.2)%3.0)/0.9)
    # --- medical panel ---
    ph=prog(t,7.0,0.6)
    if ph>0: put(fr,'hosp',scale=eback(ph),origin=(228,985))
    put(fr,'kad_t',dx=-80*(1-eo(prog(t,7.4,0.5))),alpha=prog(t,7.4,0.4))
    for j,k in enumerate(['clip','inf','chart']):
        pp=prog(t,7.8+0.4*j,0.5)
        if pp<=0: continue
        rot=0
        if k=='inf' and t>9: rot=0
        put(fr,k,scale=eback(pp),dy=40*(1-eo(pp)))
    pa=prog(t,9.2,0.45)
    if pa>0:
        a,b,c,d=E['arrow2']; im=L['arrow2']; w=int((c-a)*eo(pa))
        if w>0: fr.alpha_composite(im.crop((0,0,w,d-b)),(a,b))
    p2=prog(t,9.5,0.7)
    if p2>0:
        pulse=1+0.04*math.sin((t-10.2)*5+1.5) if t>10.2 else 1
        put(fr,'tag2',dx=500*(1-eback(p2)),scale=pulse,alpha=clamp(p2*3))
        shine(fr,'tag2',((t-10.3)%3.0)/0.9)
    # --- bottom ---
    pc=prog(t,11.0,0.7)
    if pc>0:
        wig=3*math.sin((t-11.7)*5) if t>11.7 else 0
        put(fr,'char2',dy=300*(1-eback(pc)),rot=wig,origin=(312,1340))
    pn=prog(t,11.6,0.5); put(fr,'name',dy=-20*(1-eo(pn)),alpha=pn)
    pq=prog(t,12.0,0.6)
    if pq>0:
        pulse=1+0.05*max(0,math.sin((t-12.6)*math.pi*1.25)) if t>12.6 else 1
        put(fr,'cta',scale=eelastic(pq)*pulse)
        shine(fr,'cta',((t-13.0)%2.2)/0.8)
    # overlays
    ov=Image.new('RGBA',(W,H),(0,0,0,0)); dr=ImageDraw.Draw(ov)
    burst(dr,625,705,prog(t,5.9,1.0),1); burst(dr,645,1050,prog(t,10.0,1.0),2); burst(dr,636,1262,prog(t,12.3,1.1),3)
    for (x,y,r,ph0,sp) in STARS:
        v=math.sin(t*sp+ph0)
        if v>0.6 and t>1: star(dr,x,y,r*(v-0.6)/0.4+2,(v-0.6)/0.4)
    fr.alpha_composite(ov)
    # title slam flash
    fl=1-prog(t,0.95,0.35) if t>=0.95 else 0
    if 0<fl<1: fr=Image.blend(fr,Image.new('RGBA',(W,H),(255,255,255,255)),0.35*fl)
    # camera
    if t<1.0: z=1.12-0.12*eo(t/1.0)
    else: z=1.0
    shake=0
    if 0.95<t<1.3: shake=(1.3-t)*30
    cx,cy=W/2+random.uniform(-shake,shake),H/2+random.uniform(-shake,shake)
    if shake>0: z=max(z,1.04)
    cw,ch=W/z,H/z
    cx=min(max(cx,cw/2),W-cw/2); cy=min(max(cy,ch/2),H-ch/2)
    box=(cx-cw/2,cy-ch/2,cx+cw/2,cy+ch/2)
    fr=fr.convert('RGB').resize((1080,1350),Image.BICUBIC,box=box)
    # fade in / out
    if t<0.3: fr=Image.blend(Image.new('RGB',fr.size,(0,0,0)),fr,t/0.3)
    return fr
if __name__=='__main__':
    if len(sys.argv)>1:
        for s in sys.argv[1:]: frame(int(float(s)*FPS)).save(f'prev_{s}.png')
        sys.exit()
    ff=imageio_ffmpeg.get_ffmpeg_exe()
    p=subprocess.Popen([ff,'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1350','-r',str(FPS),'-i','-',
        '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','out.mp4'],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
    for i in range(N):
        p.stdin.write(frame(i).tobytes())
    p.stdin.close(); p.wait(); print('done')
