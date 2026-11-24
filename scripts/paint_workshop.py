"""Print the Night Shift cabinet graphics and paint the dusk-window scenery."""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from paint_observatory import field_print

OUT = Path(__file__).resolve().parents[1] / "output" / "workshop-textures"
OUT.mkdir(parents=True, exist_ok=True)
RNG = random.Random(1717)


def font(size, serif=False):
    for family in (("georgiab.ttf", "DejaVuSerif-Bold.ttf") if serif else ("arialbd.ttf", "DejaVuSans-Bold.ttf")):
        try:
            return ImageFont.truetype(family, size)
        except OSError:
            pass
    return ImageFont.load_default(size)


def sky(image, stops):
    draw = ImageDraw.Draw(image)
    for y in range(image.height):
        t = y / (image.height - 1)
        idx = next((i for i in range(1, len(stops)) if stops[i][0] >= t), len(stops) - 1)
        lo, hi = stops[idx - 1], stops[idx]
        f = (t - lo[0]) / (hi[0] - lo[0])
        rgb = tuple(int(a + (b - a) * f) for a, b in zip(lo[1], hi[1]))
        draw.line((0, y, image.width, y), fill=rgb)


def star(draw, x, y, r, color):
    draw.polygon([(x,y-r),(x+r*.19,y-r*.17),(x+r*.73,y),(x+r*.18,y+r*.17),
                  (x,y+r),(x-r*.18,y+r*.17),(x-r*.73,y),(x-r*.19,y-r*.17)],fill=color)


def pine(draw,x,y,h,color):
    draw.rectangle((x-h*.018,y-h*.53,x+h*.018,y),fill=color)
    for i in range(4):
        top = y-h+i*h*.15
        half = h*(.11+i*.041)
        draw.polygon([(x,top),(x+half,top+h*.40),(x+half*.38,top+h*.36),
                      (x,top+h*.402),(x-half*.42,top+h*.36),(x-half,top+h*.40)],fill=color)


def ridgeline(w, y, amp, frequency):
    return [(x, y + amp*(math.sin(x*frequency)+.38*math.sin(x*frequency*3.3+1.9)+.13*math.cos(x*.085))) for x in range(-12,w+20,6)]


def grain():
    w,h=1024,256;im=Image.new("RGB",(w,h));d=ImageDraw.Draw(im)
    for y in range(h):
        n=4.1*math.sin(y*.105)+2.4*math.sin(y*.41)+RNG.uniform(-3.4,3.4)
        d.line((0,y,w,y),fill=(int(142+n),int(87+n),int(57+n)))
    for i in range(410):
        y=RNG.uniform(0,h);x=RNG.uniform(-180,w);length=RNG.uniform(45,580);base=RNG.choice([(116,67,43),(155,99,64),(133,83,53)])
        pts=[(x+t*length/18,y+math.sin(t*.3+x*.035)*1.6+t*.12) for t in range(19)]
        d.line(pts,fill=base,width=RNG.choice([1,1,2]))
    im.save(OUT/"grain.jpg",quality=85,optimize=True)


def night_window():
    w,h=900,630;im=Image.new("RGB",(w,h))
    sky(im,[(0,(32,52,83)),(.39,(82,104,139)),(.63,(198,151,139)),(1,(61,77,86))]);d=ImageDraw.Draw(im)
    for i in range(56):
        x,y=RNG.randint(0,w),RNG.randint(0,220);star(d,x,y,RNG.randint(1,3),"#dcd4bf")
    d.ellipse((645,104,681,140),fill="#f6d5a4")
    for y,amp,col in [(377,50,"#7c8292"),(404,45,"#586e7e"),(425,28,"#3d5967"),(485,36,"#2c454f")]:
        pts=ridgeline(w,y,amp,.009+y*.000007)
        d.polygon(pts+[(w+5,h),(-5,h)],fill=col)
    for i in range(44):pine(d,i*24-20,551+20*math.sin(i*.38),RNG.randrange(29,99),"#233e47")
    for x in [17,63,121,818,882]:pine(d,x,655,RNG.randint(270,447),"#1d333a")
    im.save(OUT/"dusk.jpg",quality=90,optimize=True)


def type_texture(filename,text,background,ink,serif=False,frame=True):
    w,h=704,170;im=Image.new("RGB",(w,h),background);d=ImageDraw.Draw(im)
    station_plate=filename in {'projects','experience','record','education','contact','projectDesk','workArchive'}
    if frame:
        d.rounded_rectangle((6,6,w-7,h-7),12,outline=ink,width=2 if station_plate else 3)
        if not station_plate:d.rounded_rectangle((15,15,w-16,h-16),13,outline=ink,width=1)
    secondary={'projects':'TO DESK','experience':'TO ARCHIVE'}.get(filename)
    if station_plate:
        # Fit the visible cap and accent strokes to the brass inlay. Default
        # font-box centering wastes most of the face at a player's viewing angle.
        face=font(170)
        left,top,right,bottom=face.getbbox(text)
        glyph=Image.new('L',(right-left,bottom-top));gd=ImageDraw.Draw(glyph)
        gd.text((-left,-top),text,font=face,fill=255)
        wh=(w-44,94 if secondary else 120)
        glyph=glyph.resize(wh,Image.Resampling.LANCZOS)
        im.paste(ink,(22,18 if secondary else int((h-wh[1])/2)),glyph)
        if secondary:
            d.text((w/2,137),secondary,font=font(32),fill=ink,anchor="mm")
        im.save(OUT/(filename+".png"),optimize=True)
        return
    f=font(98,serif)
    while d.textlength(text,font=f)>w-58:
        f=font(f.size-2,serif)
    d.text((w/2,h*.50),text,font=f,fill=ink,anchor="mm")
    im.save(OUT/(filename+".png"),optimize=True)

def bonus_scale():
    im=Image.new('RGB',(384,384),'#253c48');d=ImageDraw.Draw(im)
    d.ellipse((10,10,374,374),fill='#b38358',outline='#f0cf8b',width=4)
    d.ellipse((23,23,361,361),fill='#233b4d',outline='#e3ac74',width=3)
    d.pieslice((32,32,352,352),158,204,fill='#b35843')
    for i in range(48):
        a=(i/48)*math.tau;rr=153 if i%4 else 143
        d.line((192+rr*math.cos(a),192+rr*math.sin(a),192+159*math.cos(a),192+159*math.sin(a)),fill='#f0d59e',width=3)
    for i,roman in enumerate(['0','I','II','III']):
        a=i*math.pi/2-math.pi/2
        d.text((192+103*math.cos(a),192+102*math.sin(a)),roman,font=font(47,True),fill='#ffe7ae',anchor='mm')
    d.ellipse((163,163,221,221),outline='#c2ae82',width=3)
    im.save(OUT/'dial.png',optimize=True)


if __name__=="__main__":
    field_print(OUT);grain();night_window();bonus_scale()
    for name,text,paper,ink,serif in [
        ("projects","PROJECTS","#245254","#ffe5b1",False),
        ("experience","EXPERIENCE","#773e3e","#ffe5ae",False),
        ("resume","PDF  ↗","#ead8b7","#513e2e",False),
        ("record","RÉSUMÉ","#314e67","#ffe5b1",False),
        ("education","EDUCATION","#344d65","#ffe5b1",False),
        ("contact","CONTACT","#245958","#ffe5b1",False),
        ("projectDesk","PROJECT DESK","#183e43","#ffe3ac",False),
        ("workArchive","EXPERIENCE ARCHIVE","#65383a","#ffe3ac",False),
        ("pull","PULL","#af7849","#35291b",False),
        ("play","PLAY","#caa15c","#302d22",False),
        ("explore","EXPLORE","#caa15c","#302d22",False),
        ("maker","Daniel Ryu","#664028","#eaca96",True),
        ("archive","EXPERIENCE","#652d2b","#efd5a2",True),
        ("score","0 0 0 0 0 0","#342d26","#f4c881",False),
    ]:type_texture(name,text,paper,ink,serif)
