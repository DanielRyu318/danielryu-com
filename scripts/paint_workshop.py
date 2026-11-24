"""Paint the original signal cabinet graphics and dusk-window scenery."""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

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


def cabin(draw,x,y,size):
    s=size
    draw.polygon([(x,y-s*.54),(x+s*.34,y-s*.81),(x+s*.71,y-s*.53),(x+s*.71,y),(x,y)],fill="#ebb378")
    draw.polygon([(x+s*.71,y-s*.53),(x+s*1.10,y-s*.64),(x+s*1.1,y-s*.14),(x+s*.71,y)],fill="#a97153")
    draw.polygon([(x-.08*s,y-s*.52),(x+.34*s,y-.89*s),(x+.79*s,y-.54*s),(x+.68*s,y-.48*s),(x+.34*s,y-.74*s),(x+.02*s,y-.45*s)],fill="#f1d099")
    draw.polygon([(x+.34*s,y-.89*s),(x+.72*s,y-.99*s),(x+1.2*s,y-.65*s),(x+.79*s,y-.54*s)],fill="#546863")
    for dx in [.12,.43]:
        draw.rectangle((x+dx*s,y-.4*s,x+(dx+.10)*s,y-.22*s),fill="#fff1aa")
    draw.rectangle((x+.295*s,y-.27*s,x+.39*s,y),fill="#475751")


def landscape():
    w,h=1024,1792
    image=Image.new("RGB",(w,h))
    sky(image,[(0,(11,33,45)),(.36,(17,51,57)),(.70,(24,65,64)),(1,(14,42,43))])
    d=ImageDraw.Draw(image)
    # A screen-printed alpine night stretches from the back bank to the apron.
    d.ellipse((553,91,653,191),fill="#ebcb94")
    for _ in range(135):
        x,y=RNG.randint(40,990),RNG.randint(35,650)
        star(d,x,y,RNG.randrange(2,8),"#d8ba82")
    for y,amp,col in [(338,72,"#345760"),(369,55,"#597770"),(416,72,"#839185"),(467,49,"#47695f"),(501,40,"#294e4b")]:
        ridge=ridgeline(w,y,amp,.0087+y*.000007)
        d.polygon(ridge+[(w+10,y+94),(-10,y+94)],fill=col)
    # Reverse ink below the horizon leaves open areas for the ball and bell mechanisms.
    for i in range(39):
        x=i*28-15
        pine(d,x,543+18*math.sin(i*.46),RNG.randint(28,77),"#153638")
    for i in range(4):
        pts=[(x,1058+56*math.sin(x*.006+1.5)+i*12+13*math.sin(x*.019)) for x in range(0,w,4)]
        d.line(pts,fill=["#b4ad88","#789587","#9fa98c","#739387"][i],width=2)
    moon_ridge=[(x,1110+64*math.sin(x*.006+1.5)+13*math.sin(x*.019)) for x in range(-10,w+20,4)]
    d.polygon(moon_ridge+[(w+10,1285),(-10,1285)],fill="#748d80")
    next_ridge=ridgeline(w,1170,35,.011)
    d.polygon(next_ridge+[(w+10,1330),(-10,1330)],fill="#426e63")
    for i in range(34):
        x=i*35+RNG.randrange(-9,12);base=1205+22*math.sin(x*.012)
        pine(d,x,base,RNG.randrange(23,70),"#1b423f")
    for side in [0,1]:
        for i in range(17):
            x=RNG.randint(12,410) if side==0 else RNG.randint(647,994)
            base=1290+43*math.sin(x*.011)
            tree_height=RNG.randrange(45,117)
            pine(d,x,base,tree_height,"#103332")
            # Pencil-thin sunset ink picks up only the upper branches on the western edge.
            d.line((x-1,base-tree_height+4,x-tree_height*.082,base-tree_height*.74),fill="#5a786c",width=2)
    cabin(d,605,1253,57);cabin(d,685,1223,31)
    for x,y,size in [(472,437,23),(497,437,17),(388,454,12)]:cabin(d,x,y,size)
    # A meandering river and riverbank hatching retain their silhouettes at phone scale.
    river=[(571,1207),(531,1241),(545,1264),(600,1287),(612,1304),(560,1332),(453,1354),(404,1380),(410,1402)]
    d.line(river,fill="#b8b59a",width=14,joint="curve")
    d.line([(x-3,y-4) for x,y in river],fill="#73998b",width=6,joint="curve")
    for _ in range(44):
        x,y=RNG.randrange(40,1005),RNG.randrange(1310,1375)
        d.line((x,y,x+RNG.randrange(4,18),y-1),fill="#739586",width=2)
    cx,cy=466,1642
    for i in range(23):
        a=math.radians(190+i*7.1)
        r1,r2=77,183 if i%2==0 else 155
        points=[(cx+math.cos(a+delta)*r,cy+math.sin(a+delta)*r*.71) for delta,r in [(-.022,r1),(-.035,r2),(.035,r2),(.022,r1)]]
        d.polygon(points,fill="#d3b178" if i%2==0 else "#95a28b")
    for inset,width,color in [(14,4,"#c6a86e"),(24,2,"#9d9e7d")]:
        d.rounded_rectangle((inset,inset,w-inset,h-inset),radius=32,outline=color,width=width)
    for x,y,r in [(301,471,87),(468,990,62),(579,588,70),(716,794,61)]:
        for off in [0,7,14]:d.ellipse((x-r-off,y-r-off,x+r+off,y+r+off),outline="#9e9873",width=2)
        for i in range(20):
            a=i*math.tau/20;rr=r+20;rl=rr+(7 if i%5==0 else 3)
            d.line((x+math.cos(a)*rr,y+math.sin(a)*rr,x+math.cos(a)*rl,y+math.sin(a)*rl),fill="#b6a67d",width=2)
    # Light sweeps from the lantern are a recurring engraved motif.
    for radius,start,end in [(57,194,333),(65,204,329),(74,214,319)]:
        d.arc((301-radius,471-radius,301+radius,471+radius),start,end,fill="#e0bb81",width=3)
    for i in range(18):
        x=RNG.randint(81,900);y=RNG.randint(650,1030)
        if i%3==0:star(d,x,y,RNG.randint(6,12),"#b9a477")
    # Print alignment marks, a few large star cutouts, and calibrated lane markings.
    for x,y,r in [(756,596,16),(315,954,13),(847,1034,18),(139,879,11),(413,482,12)]:
        star(d,x,y,r,"#d7c193")
    for i in range(7):d.line((892,1460+i*15,909+(i%2)*7,1460+i*15),fill="#b59e72",width=2)
    image.save(OUT/"field.jpg",quality=95,subsampling=0,optimize=True)


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
    if frame:
        d.rounded_rectangle((7,7,w-8,h-8),18,outline=ink,width=3)
        d.rounded_rectangle((15,15,w-16,h-16),13,outline=ink,width=1)
    f=font(88,serif)
    while d.textlength(text,font=f)>w-58:
        f=font(f.size-2,serif)
    d.text((w/2,h*.50),text,font=f,fill=ink,anchor="mm",stroke_width=0)
    im.save(OUT/(filename+".png"),optimize=True)


if __name__=="__main__":
    landscape();grain();night_window()
    for name,text,paper,ink,serif in [
        ("projects","PROJECTS","#174949","#f7daa1",True),
        ("experience","EXPERIENCE","#702f31","#fde0ab",True),
        ("resume","RÉSUMÉ","#ead8b7","#513e2e",True),
        ("pull","PULL","#af7849","#35291b",False),
        ("play","PLAY","#caa15c","#302d22",False),
        ("explore","EXPLORE","#caa15c","#302d22",False),
        ("maker","Daniel Ryu","#664028","#eaca96",True),
        ("archive","EXPERIENCE","#652d2b","#efd5a2",True),
        ("score","0 0 0 0 0 0","#342d26","#f4c881",False),
    ]:type_texture(name,text,paper,ink,serif)
