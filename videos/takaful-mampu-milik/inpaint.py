import cv2, numpy as np
from elems import E
im=cv2.imread('src.jpg').astype(np.float32); H,W=im.shape[:2]
m=np.zeros((H,W),np.uint8)
for k,(a,b,c,d) in E.items(): m[b:d,a:c]=255
m=cv2.dilate(m,np.ones((13,13),np.uint8))
known=(m==0).astype(np.float32)
out=im.copy(); filled=known.copy()
for s in [12,25,50,100,200]:
    w=cv2.GaussianBlur(known,(0,0),s)
    v=cv2.GaussianBlur(im*known[...,None],(0,0),s)
    est=v/np.maximum(w,1e-6)[...,None]
    take=((w>0.03)&(filled==0))
    out[take]=est[take]; filled[take]=1
out=np.where(known[...,None]>0,im,cv2.GaussianBlur(out,(0,0),6))
def polyfill(x0,y0,x1,y1):
    reg=im[y0:y1,x0:x1]; kn=known[y0:y1,x0:x1]>0
    yy,xx=np.mgrid[y0:y1,x0:x1].astype(np.float32)
    xn=(xx-x0)/(x1-x0); yn=(yy-y0)/(y1-y0)
    A=np.stack([np.ones_like(xn),xn,yn,xn*yn,xn**2,yn**2,xn**3,yn**3,xn**2*yn,xn*yn**2],-1)
    coef,_,_,_=np.linalg.lstsq(A[kn],reg[kn],rcond=None)
    fit=A@coef
    sub=out[y0:y1,x0:x1]; mk=~kn
    sub[mk]=fit[mk]
polyfill(52,422,1034,733); polyfill(52,772,1034,1064); polyfill(192,1146,893,1346)
ov=out.copy()
def rr(img,x0,y0,x1,y1,r,col,t):
    cv2.line(img,(x0+r,y0),(x1-r,y0),col,t,cv2.LINE_AA); cv2.line(img,(x0+r,y1),(x1-r,y1),col,t,cv2.LINE_AA)
    cv2.line(img,(x0,y0+r),(x0,y1-r),col,t,cv2.LINE_AA); cv2.line(img,(x1,y0+r),(x1,y1-r),col,t,cv2.LINE_AA)
    for c,a in [((x0+r,y0+r),180),((x1-r,y0+r),270),((x0+r,y1-r),90),((x1-r,y1-r),0)]:
        cv2.ellipse(img,c,(r,r),a,0,90,col,t,cv2.LINE_AA)
rr(ov,46,416,1039,737,25,(235,248,255),3)
rr(ov,46,766,1039,1069,25,(235,245,255),3)
rr(ov,178,1131,908,1400,48,(25,20,20),8)
out=np.where((m>0)[...,None],ov,out)
cv2.imwrite('base.png',np.clip(out,0,255).astype(np.uint8))
