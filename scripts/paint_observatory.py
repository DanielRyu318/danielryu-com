"""Original two-pass screen print for the Night Shift observatory cabinet."""
import math
from pathlib import Path

from PIL import Image, ImageDraw


def field_print(path):
    w, h = 1152, 1994
    artwork=Path(__file__).resolve().parents[1]/"art"/"night-shift-print.webp"
    # Place the observatory beneath the bumper bank and preserve both edges of
    # the lithograph. The extra sky keeps the raised metalwork off the dome.
    with Image.open(artwork) as source:
        source=source.convert("RGB")
        cut=round(source.height*.55); horizon=round(h*.63)
        image=Image.new("RGB",(w,h))
        sky=source.crop((0,0,source.width,cut)).resize((w,horizon),Image.Resampling.LANCZOS)
        ground=source.crop((0,cut,source.width,source.height)).resize((w,h-horizon),Image.Resampling.LANCZOS)
        image.paste(sky);image.paste(ground,(0,horizon))
    draw=ImageDraw.Draw(image)
    copper,pale="#bc865e","#f1d495"
    def pt(x,z):
        return ((x+.52)*w/1.04,(z+.9)*h/1.8)
    def spark(x,y,r,fill):
        draw.polygon([(x,y-r),(x+r*.19,y-r*.18),(x+r*.8,y),(x+r*.17,y+r*.19),
                      (x,y+r),(x-r*.17,y+r*.19),(x-r*.8,y),(x-r*.18,y-r*.18)],fill=fill)
    def pathline(points, color, thickness):
        draw.line(points,fill=color,width=thickness,joint="curve")
    def signal_circle(x,y,r):
        for radius,color,weight in [(r+19,"#3b6270",3),(r+10,copper,3),(r,"#bfb48b",5)]:
            draw.ellipse((x-radius,y-radius,x+radius,y+radius),outline=color,width=weight)
        for i in range(30):
            a=i*math.tau/30; r1=r+16; r2=r1+(9 if i%5==0 else 4)
            pathline([(x+math.cos(a)*r1,y+math.sin(a)*r1),(x+math.cos(a)*r2,y+math.sin(a)*r2)],pale,2)
    # Printed lanes are broad strokes of enamel with distinct copper edge pinstriping.
    lanes=[
        ([(-.48,.52),(-.34,.62),(-.27,.64)],"#854d4d"),
        ([(.37,.49),(.30,.58),(.21,.65)],"#854d4d"),
        ([(-.19,.11),(-.263,-.01),(-.32,-.16),(-.425,-.32)],"#377175"),
        ([(.21,.05),(.31,-.10),(.32,-.32),(.23,-.51),(.28,-.65)],"#9b5a54"),
        ([(-.22,-.20),(-.20,-.42),(-.125,-.60),(-.19,-.78)],"#456777"),
    ]
    for knots,colour in lanes:
        pixels=[pt(*p) for p in knots]
        # Smooth quadratic corners of the original traced lane.
        for _ in range(3):
            softened=[pixels[0]]
            for a,b in zip(pixels,pixels[1:]):
                softened.extend([(a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25),
                                 (a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75)])
            pixels=softened+[pixels[-1]]
        for width,ink in [(21,copper),(17,"#172e3b"),(10,colour)]:
            pathline(pixels,ink,width)
    for x,z,r in [(-.045,.095,71),(.069,-.31,82),(.206,-.101,73)]:
        cx,cy=pt(x,z);signal_circle(cx,cy,r)
    # Shooting stars direct the player back toward the lanes.
    for x,z,angle in [(-.25,.49,-25),(.185,.48,25),(-.38,-.64,-40),(.32,.13,28)]:
        cx,cy=pt(x,z);a=math.radians(angle)
        for i in range(3):
            f=i*12
            pathline([(cx+math.sin(a)*f-4,cy+math.cos(a)*f+34),(cx+math.sin(a)*f+4,cy+math.cos(a)*f+10)],copper,2)
        spark(cx,cy,14,pale)
    for inset,width,color in [(11,4,copper),(22,2,pale),(29,2,"#52747d")]:
        draw.rounded_rectangle((inset,inset,w-inset,h-inset),radius=34,outline=color,width=width)
    for z in [-.2+i*.043 for i in range(22)]:
        x,y=pt(.462,z);draw.line((x-12,y,x+11,y),fill="#c8ae83",width=3)
    image.save(Path(path)/"field.jpg",quality=95,subsampling=0,optimize=True)
