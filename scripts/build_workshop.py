"""Build the editable Midnight Signal Workshop, then batch its static meshes for glTF.

Run paint_workshop.py using Python/Pillow first, then run this script in Blender:
blender -b -P scripts/build_workshop.py
All construction coordinates here match room-layout.json (Three.js Y-up metres).
"""
import bpy
import bmesh
import json
import math
import random
import sys
from contextlib import contextmanager
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/'scripts'))
from workshop_contacts import bake_contacts, brushed_bells

LAYOUT=json.loads((ROOT/'src/room-layout.json').read_text())
MECHANISMS=json.loads((ROOT/'src/room-mechanisms.json').read_text())
TEXTURES=ROOT/'output/workshop-textures'
if not (TEXTURES/'field.jpg').exists():
    raise RuntimeError('Run python scripts/paint_workshop.py before the Blender build.')
ART=ROOT/'art'; MODELS=ROOT/'public/models'
ART.mkdir(exist_ok=True); MODELS.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
rng=random.Random(310)
M={};CACHE={};COL=None;PARENT=None

def V(p): return Vector((p[0],-p[2],p[1]))
def P(p): return Vector(p)
def deck(z): return LAYOUT['deck']['height']-LAYOUT['deck']['slope']*z
def srgb(s):
    vals=[int(s[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals)+(1,)

def material(name,color,rough=.56,metal=0,glow=0,texture=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=srgb(color)
    surface=m.node_tree.nodes.get('Principled BSDF')
    surface.inputs['Base Color'].default_value=srgb(color)
    surface.inputs['Roughness'].default_value=rough;surface.inputs['Metallic'].default_value=metal
    if texture:
        node=m.node_tree.nodes.new('ShaderNodeTexImage')
        node.image=bpy.data.images.load(str(TEXTURES/texture),check_existing=True)
        m.node_tree.links.new(node.outputs['Color'],surface.inputs['Base Color'])
    if glow:
        surface.inputs['Emission Color'].default_value=srgb(color)
        surface.inputs['Emission Strength'].default_value=glow
        if texture:m.node_tree.links.new(node.outputs['Color'],surface.inputs['Emission Color'])
    M[name]=m;return m

for spec in [
    ('walnut','77452f',.54),('oak','af774e',.54),('honey','c19569',.61),
    ('woodGrain','ffffff',.59,0,0,'grain.jpg'),('woodDark','4e352a',.62),
    ('teal','175758',.37,.12),('deepTeal','123d42',.45,.14),
    ('brass','d6a45e',.32,.70),('brassEdge','e8bd74',.23,.73),
    ('bronze','8c693e',.37,.68),('steel','909a90',.29,.78),
    ('gunmetal','485650',.36,.72),('black','212c2a',.65,.14),
    ('enamel','f1dfb6',.35,.11),('paper','ebd8b5',.82),
    ('ivory','d9c2a2',.75),('oxblood','8d4140',.43,.10),
    ('redRubber','853c36',.7),('amber','ffc266',.29,.10,1.0),
    ('bulb','ffe8ad',.25,0,2.3),('greenShade','2f6653',.31,.27),
    ('clay','b7714e',.76),('leaf','698464',.75),('leafDark','345d4f',.75),
    ('leafLight','879c71',.77),('wall','bcab95',.93),('wallShade','a99e89',.94),
    ('rug','914e43',.95),('ink','4a5c58',.81),('navy','2b4651',.70),
    ('screenOff','403726',.48,.10),('sky','ffffff',.92,0,.43,'dusk.jpg'),
    ('field','ffffff',.44,.07,.075,'field.jpg'),('floorA','846448',.62),
    ('floorB','967456',.62),('floorC','8d6c50',.63),('floorD','806148',.64),
    ('contact','514234',.86),('boardShadow','254443',.83),('amberDeep','d8792d',.32,.11,.45),
    ('bellBrass','b18e61',.41,.79),('well','0b1416',.89),('railsDark','3b4747',.33,.58),
    ('tunnelInside','372929',.71),('aperture','473634',.56,.26),
]:material(*spec)
for name in ('projects','experience','resume','pull','play','explore','maker','archive','score'):
    material('print_'+name,'ffffff',.62,.05,.11,name+'.png')
material('rollover_west','e2be6c',.34,.12,.18)
material('rollover_east','8cb59d',.34,.12,.18)

def collection(name):
    global COL
    COL=bpy.data.collections.new(name);scene.collection.children.link(COL)

def attach(obj,where=None):
    COL.objects.link(obj)
    if where is not None:obj.location=V(where)
    if PARENT:
        obj.parent=PARENT
        obj.matrix_parent_inverse=PARENT.matrix_world.inverted()
    return obj

def mark(name,point=(0,0,0),scale=None,pitch=0):
    o=attach(bpy.data.objects.new(name,None),point);o.empty_display_size=.048
    if scale:o.scale=(scale[0],scale[2],scale[1])
    o.rotation_euler.x=pitch
    bpy.context.view_layer.update()
    return o

@contextmanager
def group(obj):
    global PARENT
    old=PARENT;PARENT=obj
    try:yield
    finally:PARENT=old

def asset(name,geometry,mat,point=(0,0,0)):
    o=bpy.data.objects.new(name,geometry)
    if not geometry.materials:geometry.materials.append(M[mat])
    o=attach(o,point)
    # A per-object material slot keeps reusable shapes shared in the editable scene.
    o.material_slots[0].link='OBJECT';o.material_slots[0].material=M[mat]
    return o

def raw(name,pts,faces,mat,smooth=False,uv=None):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([V(p) for p in pts],[],faces);mesh.update()
    if smooth:
        for f in mesh.polygons:f.use_smooth=True
    if uv:
        layer=mesh.uv_layers.new(name='Print')
        for p in mesh.polygons:
            for i in p.loop_indices:layer.data[i].uv=uv[mesh.loops[i].vertex_index]
    return asset(name,mesh,mat)

def wood_uv(mesh):
    uvs=mesh.uv_layers.new(name='Grain')
    for face in mesh.polygons:
        n=face.normal
        for i in face.loop_indices:
            p=mesh.vertices[mesh.loops[i].vertex_index].co
            if abs(n.z)>.63:coord=(p.x*1.6,p.y*2.8)
            elif abs(n.y)>.6:coord=(p.x*1.6,p.z*3)
            else:coord=(p.y*1.5,p.z*3)
            uvs.data[i].uv=coord

def box(name,c,size,mat,bevel=0,yaw=0,pitch=0,roll=0):
    dx,dy,dz=size;bevel=max(0,min(bevel,min(size)*.47))
    key=('box',tuple(round(f,5) for f in size),round(bevel,5))
    mesh=CACHE.get(key)
    if mesh is None:
        bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
        for vert in bm.verts:vert.co.x*=dx;vert.co.y*=dz;vert.co.z*=dy
        if bevel:bmesh.ops.bevel(bm,geom=list(bm.edges),offset=bevel,segments=2,affect='EDGES',profile=.5)
        mesh=bpy.data.meshes.new(name);bm.to_mesh(mesh);bm.free();mesh.update();wood_uv(mesh);CACHE[key]=mesh
    o=asset(name,mesh,mat,c);o.rotation_euler=(pitch,-roll,yaw);return o

def lathe(name,c,profile,mat,sides=24,smooth=True):
    key=('lathe',tuple(profile),sides,smooth);mesh=CACHE.get(key)
    if mesh is None:
        pts=[];faces=[]
        for height,radius in profile:
            pts.extend((math.cos(i*math.tau/sides)*radius,height,math.sin(i*math.tau/sides)*radius) for i in range(sides))
        for j in range(len(profile)-1):
            for i in range(sides):
                a=j*sides+i;b=j*sides+(i+1)%sides;faces.append((a,a+sides,b+sides,b))
        faces.append(tuple(range(sides)));faces.append(tuple(reversed(range((len(profile)-1)*sides,len(profile)*sides))))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([V(p) for p in pts],[],faces);mesh.update()
        if smooth:
            for f in list(mesh.polygons)[:-2]:f.use_smooth=True
        CACHE[key]=mesh
    return asset(name,mesh,mat,c)

def cyl(name,c,r,h,mat,sides=20,top=None):
    return lathe(name,c,[(-h/2,r),(h/2,top if top is not None else r)],mat,sides)

def rod(name,a,b,r,mat,sides=10):
    a,b=P(a),P(b);d=b-a
    o=cyl(name,(a+b)/2,r,d.length,mat,sides)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=V(d).to_track_quat('Z','Y')
    return o

def tube(name,points,r,mat,sides=9):
    pts=[P(p) for p in points];verts=[];faces=[]
    for i,p in enumerate(pts):
        direction=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        side=direction.cross(P((0,1,0)))
        if side.length<.001:side=direction.cross(P((1,0,0)))
        side.normalize();other=direction.cross(side).normalized()
        verts.extend(p+r*(math.cos(j*math.tau/sides)*side+math.sin(j*math.tau/sides)*other) for j in range(sides))
    for i in range(len(pts)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    return raw(name,verts,faces,mat,True)

def bezier(a,b,c,d,count=17):
    a,b,c,d=map(P,(a,b,c,d))
    return [(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d for t in [i/(count-1) for i in range(count)]]

def smooth_path(points,steps=6):
    points=[P(p) for p in points];result=[]
    for i in range(len(points)-1):
        a,b,c,d=points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for n in range(steps):
            t=n/steps;result.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*(t**3)))
    return result+[points[-1]]

def plane(name,c,right,up,mat):
    c,r,u=P(c),P(right)/2,P(up)/2
    return raw(name,[c-r-u,c+r-u,c+r+u,c-r+u],[(0,1,2,3)],mat,uv=[(0,0),(1,0),(1,1),(0,1)])

def plaque(name,c,w,h,mat):
    return plane(name,c,(w,0,0),(0,h,0),mat)

def screw(x,y,z,r=.010):
    cyl('Slotted brass screw',(x,y,z),r,.0035,'brassEdge',14)
    box('Screw slot',(x,y+.002,z),(r*1.22,.0007,r*.18),'bronze',yaw=.52)

def tabletop(name,x,z,w,d,y=.90):
    box(name,(x,y-.035,z),(w,.07,d),'woodGrain',.018)
    box('Apron',(x,y-.12,z+.005),(w-.08,.15,d-.08),'walnut',.015)
    for dx in [-w/2+.095,w/2-.095]:
        for dz in [-d/2+.095,d/2-.095]:box('Mortised oak leg',(x+dx,(y-.13)/2,z+dz),(.086,y-.13,.085),'oak',.012)

def furniture_lamp(x,y,z,scale=1,green=True,clamp=False):
    def pt(a,b,c):return (x+a*scale,y+b*scale,z+c*scale)
    def rr(r):return r*scale
    if clamp:
        box('Brass clamp',pt(0,.013,0),(rr(.073),rr(.06),rr(.085)),'brass',rr(.009))
    else:
        lathe('Turned lamp foot',pt(0,0,0),[(0,rr(.112)),(rr(.016),rr(.12)),(rr(.037),rr(.095)),(rr(.046),rr(.051))],'brass',32)
    curve=bezier(pt(0,.035,0),pt(-.06,.42,-.03),pt(.06,.60,-.05),pt(.19,.47,-.02))
    tube('Arched brass lamp neck',curve,rr(.014),'brass',12)
    lc=pt(.192,.394,-.017)
    lathe('Spun lamp shade',lc,[(rr(-.028),rr(.148)),(rr(-.016),rr(.148)),(rr(.033),rr(.117)),(rr(.070),rr(.069)),(rr(.077),rr(.035)),(rr(.095),rr(.026))],'greenShade' if green else 'paper',36)
    cyl('Rolled shade rim',pt(.192,.365,-.017),rr(.15),rr(.009),'brassEdge',36)
    cyl('Luminous lamp underside',pt(.192,.359,-.017),rr(.14),rr(.006),'bulb',36)

def gate(id):
    data=LAYOUT['gates'][id];x,z=data['center'];dx,dz=data['direction'];y=deck(z)
    center=P((x,y,z));right=P((-dz,0,dx)).normalized();front=P((-dx,0,-dz)).normalized()
    def pos(lift,side,f):return center+P((0,lift,0))+right*side+front*f
    outer=.143 if id=='projects' else .139;inner=.081;foot=.015
    parent=mark('Pick_'+id.capitalize())
    with group(parent):
        pts=[];faces=[];div=28
        for i in range(div+1):
            a=math.pi*i/div;ca,sa=math.cos(a),math.sin(a)
            for r,f in [(inner,.021),(outer,.021),(outer,-.026),(inner,-.026)]:
                pts.append(pos(foot+sa*r,ca*r,f))
        for i in range(div):
            a=i*4
            for n in range(4):faces.append((a+n,a+(n+1)%4,a+4+(n+1)%4,a+4+n))
        faces.extend([(0,1,2,3),(div*4+3,div*4+2,div*4+1,div*4)])
        raw('Cast enamel entrance',pts,faces,'teal' if id=='projects' else 'oxblood')
        for r in (inner+.001,outer-.001):
            tube('Polished entrance bead',[pos(foot+math.sin(i*math.pi/div)*r,math.cos(i*math.pi/div)*r,.023) for i in range(div+1)],.0033,'brassEdge')
        for side in [-1,1]:
            bar=box('Gate plinth',pos(.011,side*(outer+inner)/2,0),(.075,.023,.070),'bronze',.005)
            bar.rotation_euler.z=math.atan2(dx,-dz)
            # Sculpted keystones extend the tunnel cheeks down to the deck.
            cheek=box('Cast portal foot',pos(.043,side*.112,-.010),(.051,.067,.10),'deepTeal' if id=='projects' else 'aperture',.008)
            cheek.rotation_euler.z=math.atan2(dx,-dz)
            for yy in [.041,.072]:
                a=pos(yy,side*.120,.029);rod('Portal rivet',a,a+front*.007,.0054,'brassEdge',12)
        # Bend the enamel lettering along the radius of the casting.
        pts=[];uv=[]
        for i in range(29):
            u=i/28;a=math.radians(150-120*u)
            for rad,vv in [(inner+.008,0),(outer-.008,1)]:
                pts.append(pos(foot+math.sin(a)*rad,math.cos(a)*rad,.0238));uv.append((u,vv))
        raw('Curved lettered enamel plate',pts,[(i*2,i*2+2,i*2+3,i*2+1) for i in range(28)],'print_'+id,uv=uv)
    return parent

def entry_footwork(id):
    """A continuous load-bearing entrance from the deck through each branch mouth."""
    route=[P(p) for p in LAYOUT['routes'][id]]
    g=LAYOUT['gates'][id];dx,dz=g['direction'];front=P((-dx,0,-dz)).normalized()
    start=route[0]+front*.093;start.y=deck(start.z)+.025
    path=smooth_path([start]+route[:(4 if id=='projects' else 5)],7)
    width=.046 if id=='projects' else .045
    verts=[];faces=[];edges=[[],[]]
    for i,c in enumerate(path):
        tangent=path[min(i+1,len(path)-1)]-path[max(0,i-1)]
        side=P((-tangent.z,0,tangent.x)).normalized()
        r=width+max(0,1-i/10)*.026
        top=max(deck(c.z)+.0017,c.y-.0237)
        p=P((c.x,top,c.z));deep=.003+min(1,i/14)*(.048 if id=='projects' else .018)
        verts.extend([p-side*r,p+side*r,p+side*r-P((0,deep,0)),p-side*r-P((0,deep,0))])
        for j,sign in enumerate([-1,1]):edges[j].append(p+side*sign*r+P((0,.0038,0)))
        if i:
            for n in [0,1,2,3]:
                a=4*(i-1);faces.append((a+n,a+4+n,a+4+(n+1)%4,a+(n+1)%4))
    raw('Steel transition tongue',verts,faces,'railsDark' if id=='projects' else 'tunnelInside')
    for pts in edges:tube('Turned-up tongue edge',pts,.0039,'bronze' if id=='projects' else 'oxblood',8)
    if id=='experience':
        # Round, double-wall upper shell curves with the outgoing path under the launch wireform.
        centerline=smooth_path(route[:4],8)[:18];verts=[];faces=[];div=18
        for k,c in enumerate(centerline):
            tangent=centerline[min(k+1,len(centerline)-1)]-centerline[max(0,k-1)]
            side=P((-tangent.z,0,tangent.x)).normalized()
            for j in range(div+1):
                a=math.pi*j/div
                verts.append(c+side*(.091*math.cos(a))+P((0,.004+.094*math.sin(a),0)))
            if k:
                for j in range(div):
                    a=(k-1)*(div+1)+j;faces.append((a,a+1,a+div+2,a+div+1))
            if k in [7,16]:
                tube('Riveted tunnel band',verts[-(div+1):],.0036,'bronze',8)
        raw('Curved tunnel hood',verts,faces,'oxblood',True)
    else:
        # Timber webs make the rising portion read as a real ramp from the flipper end.
        for side_index in [0,1]:
            pts=edges[side_index];verts=[];faces=[]
            for i,p in enumerate(pts):
                base=deck(p.z)+.006 if abs(p.x)<.50 else p.y-.071
                verts.extend([p-P((0,.002,0)),P((p.x,min(base,p.y-.003),p.z))])
                if i:faces.append((i*2-2,i*2,i*2+1,i*2-1))
            raw('Walnut flyover cheek',verts,faces,'walnut')

def tracks(points,id):
    nodes=smooth_path(points,7);edge=.017
    rails=[[],[]];bed=[];faces=[]
    for i,p in enumerate(nodes):
        direction=nodes[min(i+1,len(nodes)-1)]-nodes[max(0,i-1)];side=P((-direction.z,0,direction.x)).normalized()
        for index,sg in enumerate([-1,1]):rails[index].append(p+side*(edge*sg)+P((0,-.018,0)))
        if id=='experience':
            bed.extend([p-side*.037+P((0,-.013,0)),p-side*.036+P((0,-.037,0)),p+side*.036+P((0,-.037,0)),p+side*.037+P((0,-.013,0))])
            if i:
                for j in range(3):faces.append(((i-1)*4+j,i*4+j,i*4+j+1,(i-1)*4+j+1))
    if bed:raw('Oxblood delivery channel',bed,faces,'oxblood')
    for rail in rails:tube('Polished signal track',rail,.0048,'brassEdge' if id!='launcher' else 'steel',10)
    for i in range(3,len(nodes)-3,9):
        p=nodes[i];rod('Track yoke',rails[0][i]-P((0,.005,0)),rails[1][i]-P((0,.005,0)),.0045,'bronze',8)
        if abs(p.x)<.53:
            low=deck(p.z)+.013
            if p.y-.031>low:rod('Riser post',(p.x,low,p.z),(p.x,p.y-.030,p.z),.0072,'brass')
    if id!='launcher':
        for i in ([int(len(nodes)*.61),int(len(nodes)*.81)] if id=='projects' else [int(len(nodes)*.71)]):
            p=nodes[i]
            barrier=.87 if abs(p.x)>1.23 else .16
            rod('Brass crossing stanchion',(p.x,barrier,p.z),(p.x,p.y-.04,p.z),.022,'brass')
            if barrier<.5:
                lathe('Crossing pedestal',(p.x,.005,p.z),[(0,.103),(.032,.103),(.048,.073),(.12,.052),(.165,.036)],'bronze')

def cabinet_cheeks():
    """A pair of physical flipper buttons and pinstriped service panels on the outer cheeks."""
    for sign,side in [(-1,'Left'),(1,'Right')]:
        x=sign*.569
        for offset,finish in [(0,'deepTeal'),(.012,'honey'),(.020,'oxblood')]:
            points=[(x,.673+offset,-.82),(x,.674+offset,-.31),
                    (x,.688+offset,-.04),(x,.724+offset,.17),(x,.730+offset,.43)]
            tube('Coach line',smooth_path(points,4),.005 if not offset else .0025,finish,6)
        z=.57;y=deck(z)-.112
        rod('Flipper ferrule',(x-sign*.009,y,z),(x+sign*.009,y,z),.037,'bronze',32)
        rod('Painted button cup',(x+sign*.007,y,z),(x+sign*.012,y,z),.032,'well',28)
        with group(mark('Cabinet_Button_'+side,(x,y,z))):
            rod('Side flipper button',(x+sign*.010,y,z),(x+sign*.025,y,z),.027,'oxblood',28)


def telegraph_bank():
    bank=MECHANISMS['dropBank']
    facing=P((bank['normal'][0],0,bank['normal'][1])).normalized()
    across=P((bank['tangent'][0],0,bank['tangent'][1])).normalized()
    up=P((0,1,0));heading=math.atan2(facing.x,facing.z)
    w,d,h=bank['width'],bank['depth'],bank['height']
    for i,target in enumerate(bank['targets']):
        x,z=target['x'],target['z']
        p=P((x,deck(z),z))
        box('Target socket plate',p+up*.002,(w+.006,.004,d+.018),'bronze',.0015,yaw=heading)
        box('Dark drop slot',p+up*.0045,(w+.002,.002,d+.006),'well',.0008,yaw=heading)
        for end in [-1,1]:
            screw_at=p+across*(w*.38*end)-facing*.010
            screw(screw_at.x,p.y+.005,screw_at.z,.0023)
        # The face, markings and a bevelled coloured cap all travel into the slot.
        with group(mark(target['node'],p)):
            box('Porcelain blade',p+up*(h*.51),(w,h*.98,d),'enamel',.0032,yaw=heading)
            box('Telegraph cap',p+up*(h-.008),(w+.001,.013,d+.001),['oxblood','deepTeal','bronze'][i],.002,yaw=heading)
            for mark_index in range(i+1):
                center=p+across*((mark_index-i/2)*.0064)+up*(h*.50)+facing*(d*.52)
                box('Signal tally',center,(.0031,.018,.0018),'deepTeal',.0007,yaw=heading)
            underline=p+up*(h*.23)+facing*(d*.52)
            box('Signal underline',underline,(w*.56,.0015,.0013),'bronze',.0005,yaw=heading)


def signal_spinner():
    config=MECHANISMS['spinner'];x,z=config['x'],config['z']
    pivot=P((x,deck(z)+config['axisHeight'],z));up=P((0,1,0))
    for xx,zz in config['posts']:
        low=deck(zz)
        cyl('Spinner post footing',(xx,low+.003,zz),.010,.006,'bronze')
        rod('Spinner upright',(xx,low+.003,zz),(xx,pivot.y,zz),config['postRadius'],'brass',14)
        rod('Axle bush',(xx-.005,pivot.y,zz),(xx+.005,pivot.y,zz),.0085,'bronze',16)
    with group(mark(config['node'],pivot)):
        rod('Signal shaft',pivot-P((.071,0,0)),pivot+P((.071,0,0)),.0033,'steel',12)
        box('Semaphore pennant',pivot-up*.022,(config['width'],.051,.0065),'bronze',.0030)
        for sign,paint in [(1,'deepTeal'),(-1,'oxblood')]:
            c=pivot-up*.023+P((0,0,sign*.0038))
            plane('Enamel flag',c,(sign*.102,0,0),(0,.038,0),paint)
            for k in range(3):
                center=c+P((sign*(k-1)*.025,0,sign*.001))
                raw('Semaphore chevron',[center+P((sign*a,b,0)) for a,b in [
                    (-.009,-.010),(-.002,-.010),(.009,0),(-.002,.010),(-.009,.010),(.002,0)
                ]],[(0,1,2,5),(2,3,4,5)],'enamel')
        for offset in [-.037,.037]:
            rod('Folded pennant loop',pivot+P((offset-.006,0,0)),pivot+P((offset+.006,0,0)),.0055,'brass',12)


def lane_rollovers():
    for lens in MECHANISMS['rollovers']:
        x,z,r=lens['x'],lens['z'],lens['radius'];y=deck(z)
        with group(mark(lens['node'],(x,y,z))):
            cyl('Inlaid lens bezel',(x,y+.0016,z),r,.003,'bronze',28)
            cyl('Smoked signal glass',(x,y+.0032,z),r*.84,.0027,'deepTeal',28)
            pts=[(x+a*r,y+.0050-(b*r)*.065,z+b*r) for a,b in [
                (-.54,.39),(-.12,.39),(-.12,.58),(.16,.58),(.16,.39),(.54,.39),(0,-.63)]]
            raw('Rollover arrow',pts,[(0,1,5,6),(1,2,3,4),(1,4,5)],lens['material'])


def cabinet():
    collection('01 • Signal cabinet')
    # The bevelled rim has a physical break at each outgoing rail.
    box('Cabinet body',(0,.755,0),(1.134,.30,1.94),'woodGrain',.028,pitch=.063)
    box('Drawer plinth',(0,.600,0),(1.11,.045,1.88),'woodDark',.014,pitch=.063)
    for x,segments in [(-.544,[(-.942,-.61),(-.39,.955)]),(.544,[(-.94,-.825),(-.674,.955)])]:
        for a,b in segments:
            z=(a+b)/2;box('Carved walnut rim',(x,deck(z)+.023,z),(.073,.093,b-a),'woodGrain',.013,pitch=.065)
            box('Burnished rail cap',(x,deck(z)+.069,z),(.023,.010,b-a-.008),'bronze',.004,pitch=.065)
    box('Back rail',(0,deck(-.915)+.043,-.919),(1.12,.125,.084),'woodGrain',.015,pitch=.065)
    plane('Cabinet_Playfield',(0,.94,0),(1.04,0,0),(0,.117,-1.8),'field')
    box('Palm rest',(0,deck(.855)+.008,.870),(1.095,.064,.166),'woodGrain',.021,pitch=.065)
    plane('Maker signature',(.07,deck(.88)+.045,.878),(.22,0,0),(0,.002,-.047),'print_maker')
    box('Porcelain repair key',(-.543,deck(.19)+.073,.19),(.073,.004,.035),'ivory',.001,yaw=.3,pitch=.065)
    for x in [-.546,.546]:
        for z in [-.865,-.32,.32,.81]:screw(x,deck(z)+.077,z,.008)
    for x in [-.462,.462]:
        for z in [-.78,.78]:
            rod('Tapered walnut leg',(x*1.1,.041,z*1.05),(x,.76,z),.038,'walnut',12)
            cyl('Leveling foot',(x*1.1,.026,z*1.05),.046,.046,'bronze')
    cabinet_cheeks()
    for id in ['projects','experience']:gate(id)
    collection('02 • Mechanical playfield')
    telegraph_bank();signal_spinner();lane_rollovers()
    for rail in LAYOUT['rails']:
        coords=rail['points'];pts=[(x,deck(z)+.027,z) for x,z in coords];r=rail['radius']
        sling='sling' in rail['id'];ret='return' in rail['id']
        for a,b in zip(pts,pts[1:]):rod('Collision guide',a,b,r,'gunmetal' if 'wall' in rail['id'] else ('redRubber' if sling else 'brass'),14)
        for j,(x,z) in enumerate(coords if ret else coords[:-1]):
            cyl('Rubber guide socket',(x,deck(z)+.021,z),r*1.28,.035,'redRubber',16)
            cyl('Standoff cap',(x,deck(z)+(.045 if not ret else .051),z),r*1.12,.010,'brassEdge',20)
            if not 'wall' in rail['id']:screw(x,deck(z)+(.051 if not ret else .057),z,r*.55)
        if sling:
            shape=[P((x,deck(z)+.045,z)) for x,z in coords[:3]]
            centroid=sum(shape,P((0,0,0)))/3
            top=[p.lerp(centroid,.055) for p in shape]
            raw('Lacquered sling shield',top+[p-P((0,.012,0)) for p in top],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'deepTeal')
            stroke=[p.lerp(centroid,.18)+P((0,.002,0)) for p in top]
            tube('Brass sling piping',stroke+stroke[:1],.0019,'brassEdge',7)
            for p in top:screw(p.x,p.y+.006,p.z,.0058)
    for b in LAYOUT['bumpers']:
        x,z,r=b['x'],b['z'],b['radius'];y=deck(z)
        cyl('Bell mounting shadow',(x,y+.001,z),r*1.30,.0014,'boardShadow')
        lathe('Bell solenoid foot',(x,y,z),[(.001,r*1.13),(.010,r*1.18),(.014,r*1.02),(.021,r*.78),(.043,r*.71)],'brass',28)
        cyl('Oxblood bumper rubber',(x,y+.027,z),r,.018,'redRubber',28)
        lathe('Bumper_'+b['id'],(x,y,z),[(.034,r*.98),(.041,r*1.06),(.049,r*1.07),(.068,r*.91),(.081,r*.53),(.084,r*.22)],'bellBrass',36)
        cyl('Bell finial',(x,y+.088,z),r*.20,.009,'brassEdge')
        for j in range(9):
            a=j*math.tau/9
            rod('Bell vent',(x+math.cos(a)*r*.48,y+.083,z+math.sin(a)*r*.48),(x+math.cos(a)*r*.79,y+.0753,z+math.sin(a)*r*.79),.0026,'well',8)
        cyl('Bright bell hem',(x,y+.044,z),r*1.083,.0036,'brassEdge',36)
    # A faceted amber wayside signal sits in the protected horseshoe.
    p=LAYOUT['anchors']['hobbies'];x,z=p[0],p[2];y=deck(z)
    lantern=mark('Pick_Hobbies')
    with group(lantern):
        lathe('Signal pedestal',(x,y,z),[(.002,.043),(.012,.046),(.017,.032),(.045,.025),(.050,.036)],'bronze')
        lathe('Amber signal lens',(x,y,z),[(.05,.031),(.060,.034),(.101,.027),(.108,.023)],'amberDeep',8,False)
        lathe('Lantern hood',(x,y,z),[(.106,.025),(.110,.039),(.118,.030),(.137,.011),(.140,.007)],'bronze',8,False)
        for i in range(4):
            a=(i+.5)*math.pi/2
            rod('Lantern cage',(x+.032*math.cos(a),y+.052,z+.032*math.sin(a)),(x+.025*math.cos(a),y+.109,z+.025*math.sin(a)),.0025,'gunmetal',7)
    for id,points in LAYOUT['routes'].items():
        tracks(points,id);entry_footwork(id)
    if 'crossing' in LAYOUT:
        tracks(LAYOUT['crossing'],'crossing')
    tracks(LAYOUT['launcher']['path'],'launcher')
    # Open launch trough continues all the way underneath the working runtime spring.
    for x in [.425,.504]:box('Shooter lane',(x,deck(.64)+.016,.64),(.012,.029,.47),'bronze',.005,pitch=.065)
    for x in [.432,.496]:rod('Spring cradle',(x,deck(.85)+.01,.85),(x,deck(.59)+.01,.59),.004,'steel')
    plane('Pull instruction',(.463,deck(.865)+.047,.866),(.097,0,0),(0,.004,-.052),'print_pull')
    # The short truss and rivets cross above the unoccupied rear lane.
    for z in [-.712,-.765]:
        arch=bezier((-.22,deck(z)+.018,z),(-.15,1.164,z),(.015,1.160,z),(.104,deck(z)+.018,z))
        tube('Riveted crossover arch',arch,.009,'brass')
        rod('Truss chord',(-.214,deck(z)+.022,z),(.098,deck(z)+.022,z),.007,'bronze')
        for i in [3,6,9,12]:rod('Truss web',arch[i],(arch[i].x+.019,deck(z)+.022,z),.0039,'steel',8)
    # A dark catch well beneath the drain opening. The milled rim sits flush with the apron.
    x,z=-.025,.755;y=deck(z)
    lathe('Drain mouth',(x,y,z),[(.001,.066),(.006,.069),(.011,.066),(.012,.059),(.008,.055),(.002,.053)],'bronze',48)
    cyl('Drain pocket',(x,y+.004,z),.055,.003,'well',48)
    for side in [-1,1]:
        a=side*.047+x
        rod('Drain guard',(a,y+.003,z+.016),(a+side*.009,y+.013,z+.051),.0044,'gunmetal')
    # Real paper résumé and the mechanical play/explore plate share the apron.
    box('Play Explore switch casing',(.325,deck(.725)+.034,.730),(.196,.064,.119),'bronze',.012,pitch=.065)
    for name,word,x,z,w,h in [('Pick_Resume','resume',-.381,.785,.161,.061),('Pick_Play','play',.300,.700,.125,.039),('Pick_Explore','explore',.300,.756,.125,.039)]:
        with group(mark(name)):
            y=deck(z)+(.046 if name=='Pick_Resume' else .069)
            box('Engraved apron plate',(x,y,z),(w+.007,.012,h+.007),'paper' if word=='resume' else 'bronze',.004,pitch=.065)
            plane('Apron lettering',(x,y+.008,z),(w,0,0),(0,h*.065,-h),'print_'+word)
    # Low cut-rim lamp remains visible in the return shot from across the room.
    furniture_lamp(-.555,deck(-.615)+.087,-.61,.53,True,True)
    with group(mark('Pick_Score')):
        box('Score case',(0,1.165,-.888),(.29,.108,.055),'walnut',.012)
        plaque('Mechanical score window',(0,1.165,-.857),.263,.069,'print_score')
        for x in [-.105,.105]:rod('Score bracket',(x,1.03,-.888),(x,1.12,-.888),.009,'brass')

def spring_axes(station):
    path=LAYOUT['routes'][station]
    origin=P(path[-1]);axis=origin-P(path[-2]);axis.y=0;axis.normalize()
    across=P((axis.z,0,-axis.x))
    return origin,axis,across


def return_cup_shell(station):
    origin,axis,across=spring_axes(station)
    # Two formed cheeks retain the arriving ball. A full ball-width trough through the
    # centre lets it follow the return shoe all the way to its compressed position.
    profile=[(-.051,.047),(-.047,.055),(.005,.055),(.009,.052),(.007,.048),(-.016,.042),(-.034,.027)]
    for start in [37,217]:
        verts=[];faces=[]
        for i in range(22):
            a=math.radians(start+106*i/21);radial=axis*math.cos(a)+across*math.sin(a)
            for y,r in profile:verts.append(origin+radial*r+P((0,y,0)))
            if i:
                for j in range(len(profile)-1):
                    k=(i-1)*len(profile)+j
                    faces.append((k,k+1,k+len(profile)+1,k+len(profile)))
        n=len(profile)
        faces.append(tuple(reversed(range(n))))
        faces.append(tuple(range(len(verts)-n,len(verts))))
        raw('Slotted tipping cup',verts,faces,'brass',True)
    cyl('Turned cup sole',origin-P((0,.049,0)),.048,.015,'bronze',28)
    cyl('Pocket lining',origin-P((0,.038,0)),.037,.006,'woodDark',28)


def return_spring_mount(station):
    origin,axis,across=spring_axes(station)
    y_axis=P((0,1,0));end=origin+axis*.153;heading=math.atan2(axis.x,axis.z)
    root=mark('Spring_Mount_'+station.capitalize(),end)
    root.rotation_euler.z=heading;bpy.context.view_layer.update()
    with group(root):
        for sign in [-1,1]:
            offset=across*(.014*sign)-y_axis*.0215
            rod('Return ball guide',origin+offset+axis*.011,origin+offset+axis*.115,.0032,'steel',10)
        for t in [.063,.106]:
            point=origin+axis*t-y_axis*.028
            rod('Guide tie',point-across*.023,point+across*.023,.004,'bronze',8)
        seat=end.copy();seat.y=.908
        box('Plunger chassis',seat,(.067,.014,.082),'walnut',.004,yaw=heading)
        # A bored bronze bearing supports the moving shaft. Its bore is deliberately open.
        verts=[];faces=[]
        profile=[(-.013,.012),(-.013,.024),(-.007,.027),(.010,.025),(.014,.021),(.014,.012)]
        for i in range(28):
            a=i*math.tau/28;ring=across*math.cos(a)+y_axis*math.sin(a)
            verts.extend(end+axis*t+ring*r for t,r in profile)
        n=len(profile)
        for i in range(28):
            for j in range(n):
                k=i*n+j;side=(i+1)%28*n
                faces.append((k,side+j,side+(j+1)%n,i*n+(j+1)%n))
        raw('Plunger shaft bearing',verts,faces,'brass',True)
        for sign in [-1,1]:
            offset=across*(.021*sign)
            rod('Spring bracket',seat+offset,end+offset-y_axis*.015,.006,'bronze',10)
            at=seat+offset+axis*.021
            screw(at.x,seat.y+.008,at.z,.004)
    return root


def cup_assembly(name,landing,linked=False):
    x,y,z=landing
    pivot=mark(name,(x,y-.048,z))
    station='experience' if linked else 'projects'
    with group(pivot):
        return_cup_shell(station)
        rod('Pivot axle',(x-.072,y-.031,z),(x+.070,y-.031,z),.009,'bronze',12)
    for dx in [-.064,.064]:
        box('Pivot pedestal',(x+dx,.915+(y-.031-.915)/2,z),(.015,max(.026,y-.031-.915),.044),'bronze',.006)
    if linked:
        tube('Card lift arm',[(x+.055,y-.027,z),(x+.14,y+.006,z-.028),(x+.25,y+.018,z-.133)],.009,'brass',10)
        rod('Push rod',(x+.25,y+.018,z-.133),(x+.25,1.151,-1.006),.008,'brassEdge',10)
    return_spring_mount(station)
    return pivot

def mug(x,y,z,scale=1):
    r=.052*scale
    lathe('Glazed tea cup',(x,y,z),[(0,r*.63),(.008*scale,r*.72),(.019*scale,r*.79),(.075*scale,r),(.081*scale,r),(.083*scale,r*.92),(.073*scale,r*.88)],'enamel',24)
    cyl('Tea',(x,y+.075*scale,z),r*.87,.002,'woodDark',24)
    profile=bezier((x+r*.83,y+.065*scale,z),(x+r*1.93,y+.078*scale,z),(x+r*1.92,y+.006*scale,z),(x+r*.71,y+.026*scale,z))
    tube('Porcelain loop',profile,.007*scale,'enamel',8)

def plant(x,y,z,scale=1):
    p=P((x,y,z)); s=scale
    lathe('Terracotta pot',p,[(0,.092*s),(.018*s,.107*s),(.19*s,.143*s),(.194*s,.158*s),(.218*s,.156*s),(.223*s,.145*s)],'clay',22)
    cyl('Potting soil',p+P((0,.219*s,0)),.136*s,.01*s,'woodDark',18)
    for i in range(19):
        a=i*2.39996+.45;reach=rng.uniform(.14,.31)*s;height=rng.uniform(.22,.42)*s
        forward=P((math.cos(a),0,math.sin(a)));side=P((-math.sin(a),0,math.cos(a)))
        base=p+P((0,.215*s,0));end=base+forward*reach+P((0,height,0))
        mid=base.lerp(end,.6)+P((0,.052*s,0));start=base.lerp(end,.23);rib=mid+P((0,.031*s,0))
        l=mid+side*.045*s;r=mid-side*.046*s
        raw('Foliage',[start,l,rib,r,end],[(0,2,1),(0,3,2),(2,4,1),(3,4,2),(1,2,0),(2,3,0),(1,4,2),(2,4,3)],['leaf','leafDark','leafLight'][i%3])
        rod('Leaf stem',base,start,.0036*s,'leafDark',5)

def book(x,y,z,w=.183,l=.238,color='oxblood',heading=.05):
    box('Linen-bound book',(x,y+.016,z),(w,.032,l),'paper',.003,yaw=heading)
    for dy in [.001,.036]:box('Book cover',(x,y+dy,z),(w+.008,.006,l+.01),color,.002,yaw=heading)

def projects():
    collection('03 • Projects study')
    tabletop('Writing desk',-1.80,-1.08,1.54,1.18)
    for j in range(3):
        box('Drawer',(-2.29,.76-j*.134,-.528),(.37,.118,.08),'woodGrain',.013)
        rod('Drawer bail',(-2.345,.77-j*.134,-.475),(-2.235,.77-j*.134,-.475),.009,'bronze')
    caster=mark('Projects_CRT_Swivel',(-1.80,1.005,-1.32))
    with group(caster):
        lathe('Monitor pedestal',(-1.80,.902,-1.32),[(0,.141),(.015,.145),(.035,.096),(.082,.060),(.116,.094)],'bronze',30)
        box('CRT shell',(-1.80,1.32,-1.333),(.53,.47,.31),'walnut',.062)
        box('Curved CRT molding',(-1.80,1.342,-1.199),(.484,.366,.05),'bronze',.023)
        box('Tube bezel',(-1.80,1.34,-1.180),(.434,.311,.016),'black',.007)
        plaque('Idle tube',(-1.80,1.34,-1.1707),.402,.279,'screenOff')
        mark('Anchor_CRT',(-1.80,1.34,-1.170),(.397,.275,1))
        for j in range(2):
            rod('Knurled tuning dial',(-1.98+j*.36,1.127,-1.202),(-1.98+j*.36,1.127,-1.166),.028,'brass',20)
        rod('Standby lamp',(-1.80,1.122,-1.19),(-1.80,1.122,-1.175),.008,'amber',16)
        for i in range(8):
            box('Cabinet vent',(-2.067,1.20+i*.032,-1.351),(.003,.009,.156),'woodDark',.001)
    cup_assembly('Projects_Cup',LAYOUT['anchors']['projects'])
    switch=mark('Anchor_Switch',(-2.05,.962,-.96),(.17,.073,1),math.radians(-44))
    switch.rotation_euler.z=math.radians(-90)
    box('Reversing switch mount',(-2.05,.923,-.96),(.199,.059,.112),'walnut',.009,yaw=math.radians(-90))
    furniture_lamp(-2.30,.90,-.785,.79)
    # Two open pages, visible stitch and real pencil are the marks of an inhabited workbench.
    for side in [-1,1]:
        box('Open notebook page',(-1.88+side*.077,.912,-.667),(.154,.014,.208),'paper',.003,roll=side*.043)
        for j in range(6):
            box('Pencil line',(-1.88+side*.076,.924,-.726+j*.022),(.103 if j%3 else .072,.0008,.0018),'ivory')
    rod('Notebook spine',(-1.88,.916,-.77),(-1.88,.916,-.56),.005,'oak')
    rod('Desk pencil',(-1.787,.918,-.538),(-1.617,.918,-.585),.004,'deepTeal',8)
    mug(-2.225,.90,-.581,.93)
    book(-2.266,.90,-1.392,.191,.253,'deepTeal');book(-2.263,.942,-1.389,.171,.226,'oxblood',-.09)
    plant(-2.396,.90,-1.384,.62)

def archive():
    collection('04 • Letterpress archive')
    tabletop('Archive workbench',1.80,-.978,1.53,1.08)
    # Index facade wraps the HTML-backed Three texture region with an oak frame.
    box('Type case backing',(1.8,1.41,-1.12),(1.36,.81,.15),'walnut',.021)
    box('Card drawer recess',(1.8,1.32,-1.038),(1.10,.432,.026),'woodDark',.012)
    for x in [1.242,2.358]:box('Archive stile',(x,1.365,-1.018),(.064,.65,.085),'woodGrain',.009)
    for y in [1.101,1.533]:box('Archive rail',(1.80,y,-1.019),(1.164,.036,.089),'oak',.007)
    box('Archive cornice',(1.8,1.838,-1.107),(1.42,.072,.22),'woodGrain',.016)
    box('Archive name surround',(1.8,1.675,-1.024),(.69,.140,.077),'bronze',.012)
    plaque('Stamped archive header',(1.80,1.675,-.983),.647,.105,'print_archive')
    for dx in [-.57,-.41,.41,.57]:
        box('Chase storage tray',(1.80+dx,1.644,-1.008),(.128,.094,.064),'oak',.006)
        box('Ivory drawer ticket',(1.80+dx,1.644,-.972),(.099,.049,.008),'paper',.002)
    for dx in [-.46,-.15,.17,.47]:
        box('Sort cabinet drawer',(1.80+dx,.77,-.462),(.272,.154,.073),'woodGrain',.012)
        box('Index pull',(1.80+dx,.779,-.417),(.082,.035,.018),'bronze',.007)
    mark('Anchor_Archive',(1.80,1.32,-1.020),(1.02,.385,1))
    mark('Archive_Carriage',(1.80,1.14,-1.012))
    cup_assembly('Experience_Cup',LAYOUT['anchors']['experience'],True)
    furniture_lamp(2.19,.90,-1.05,1.67,False)
    for i in range(2):
        x,z=1.93+i*.23,-.713-i*.08
        rod('Ink brayer',(x-.064,.960,z),(x+.064,.960,z),.033,'oxblood',22)
        rod('Roller axle',(x-.083,.960,z),(x+.083,.960,z),.006,'steel')
        tube('Roller yoke',[(x-.081,.96,z),(x-.066,.959,z+.061),(x+.066,.959,z+.061),(x+.081,.96,z)],.005,'brass')
        rod('Brayer grip',(x,.957,z+.059),(x,.951,z+.137),.014,'walnut',14)
    for i in range(3):
        cyl('Ink canister',(2.32-i*.081,.944,-.553),.030,.087,['oxblood','navy','walnut'][i])
        cyl('Tin lid',(2.32-i*.081,.993,-.553),.033,.012,'bronze')
    # The low route reveals the archive after the ball rounds a real slatted divider.
    for z in [-1.69,-.88]:box('Divider pillar',(1.16,.96,z),(.073,1.92,.074),'woodGrain',.011)
    for i in range(6):
        box('Divider slat',(1.16,1.02,-1.59+i*.124),(.052,1.78,.065),'oak',.006)
    for y in [.14,1.87]:box('Divider header',(1.16,y,-1.284),(.092,.084,.92),'walnut',.011)

def room():
    collection('05 • Timber room')
    box('Subfloor',(0,-.085,.20),(6.80,.14,5.54),'woodDark')
    for i in range(28):
        z=-2.45+i*.194;offset=(i%3)*.51
        cuts=sorted(set([-3.39,3.39]+[x+offset for x in [-2.60,-.79,1.21,2.88] if -3.30<x+offset<3.30]))
        for j,(a,b) in enumerate(zip(cuts,cuts[1:])):
            box('Waxed floorboard',((a+b)/2,-.009,z),(b-a-.004,.030,.190),['floorA','floorB','floorC','floorD'][(i*3+j*7)%4],.003)
    # The south lining and transom become visible from the northwest desk.
    box('North plaster',(0,1.48,-2.425),(6.79,2.96,.09),'wall',.008)
    box('South plaster',(0,1.48,2.98),(6.79,2.96,.09),'wallShade',.008)
    for i in range(25):
        box('South lining board',(-3.25+i*.271,.51,2.911),(.267,.984,.040),['floorB','floorC','floorD'][i%3],.005)
    box('Wainscot cap',(0,1.024,2.89),(6.78,.067,.085),'woodGrain',.009)
    # The transom repeats the blue evening light above the opposite workbench.
    box('South transom frame',(-.12,2.09,2.90),(1.61,.59,.105),'walnut',.021)
    plane('South transom glass',(-.12,2.09,2.84),(-1.50,0,0),(0,.47,0),'sky')
    for dx in [-.53,0,.53]:box('Transom mullion',(-.12+dx,2.09,2.825),(.036,.51,.045),'oak',.004)
    box('Back wall ledge',(1.83,1.40,2.83),(1.00,.055,.193),'woodGrain',.008)
    plant(2.09,1.431,2.79,.68)
    for i in range(4):box('Journals',(1.44+i*.08,1.54,2.80),(.065,.225,.145),['navy','oxblood','deepTeal','oak'][i],.005)
    box('West plaster',(-3.43,1.48,.20),(.09,2.96,5.38),'wallShade',.008)
    box('East plaster',(3.43,1.48,.20),(.09,2.96,5.38),'wall',.008)
    box('Skirting north',(0,.102,-2.36),(6.78,.201,.09),'walnut',.011)
    for x in [-3.368,3.368]:box('Skirting side',(x,.10,.20),(.07,.20,5.36),'walnut',.008)
    for x in [-3.31,-1.95,.76,3.3]:
        box('Timber upright',(x,1.47,-2.33),(.13,2.94,.16),'woodGrain',.012)
    for z in [-2.26,-.13,2.14]:
        box('Ceiling joist',(0,2.86,z),(6.81,.23,.18),'woodGrain',.017)
    box('Ceiling boards',(0,3.00,.2),(6.85,.07,5.4),'wallShade')
    # An original dusk panorama behaves as distant scenery through thick, bevelled mullions.
    wx,wy,w,h=-.56,1.75,1.94,1.19
    box('Window recess',(wx,wy,-2.341),(w+.15,h+.16,.11),'woodDark',.015)
    plaque('Twilight foothills',(wx,wy,-2.279),w,h,'sky')
    for x in [wx-w/2,wx,wx+w/2]:
        box('Sash upright',(x,wy,-2.242),(.050,h+.063,.058),'walnut',.006)
    for y in [wy-h/2,wy,wy+h/2]:
        box('Sash crossbar',(wx,y,-2.242),(w+.067,.052,.060),'oak',.007)
    box('Deep window sill',(wx,wy-h/2-.045,-2.19),(w+.22,.070,.230),'woodGrain',.012)
    plant(.259,wy-h/2-.01,-2.19,.67)
    box('West book ledge',(-2.40,1.95,-2.18),(1.14,.063,.238),'woodGrain',.012)
    for i in range(8):
        x=-2.83+i*.084
        box('Book spine',(x,2.10+(i%4)*.012,-2.18),(.071,.23+(i%4)*.024,.155),['oxblood','deepTeal','walnut','navy'][i%4],.005,roll=.035 if i%4==0 else 0)
        box('Gold spine band',(x,2.04,-2.097),(.047,.009,.003),'brass')
    plant(-2.015,1.988,-2.15,.63)
    # Small framed block prints and pinned paper proofs in the printmaker's corner.
    for x,y,sz in [(1.22,2.05,.25),(1.72,2.15,.29),(2.30,2.04,.24)]:
        box('Dark print frame',(x,y,-2.31),(sz+.055,sz*1.12+.055,.054),'woodDark',.009)
        plaque('Cream laid paper',(x,y,-2.279),sz,sz*1.12,'paper')
        for j in range(3):
            px=x+(j-1)*sz*.21;low=y-sz*.32
            raw('Letterpress tree',[(px-.053,low,-2.276),(px+.053,low,-2.276),(px,y+sz*(.27+(j%2)*.09),-2.276)],[(0,1,2)],'ink')
    for z in [-.37,.22]:
        box('Side pegboard',(3.34,1.67,z),(.06,.52,.51),'woodDark',.009)
        for j in range(4):
            rod('Hanging tool',(3.29,1.49,z-.15+j*.095),(3.29,1.79,z-.15+j*.095),.008,'steel',9)
            cyl('Tool handle',(3.29,1.51,z-.15+j*.095),.018,.093,'oak',10)
    # Faded woven runner with a narrow ochre border.
    box('Woven runner',(-1.52,.014,.75),(1.12,.015,1.62),'rug',.006)
    for x in [-2.033,-1.005]:box('Woven border',(x,.023,.75),(.019,.002,1.57),'honey')
    for z in [-.004,1.504]:box('Woven border',(-1.52,.023,z),(1.01,.002,.016),'honey')
    for i in range(5):
        zz=.17+i*.293
        tube('Rug diamond',[(-1.52,.026,zz-.10),(-1.31,.026,zz),(-1.52,.026,zz+.10),(-1.73,.026,zz),(-1.52,.026,zz-.10)],.004,'honey',5)
    plant(-2.93,.01,-.34,1.29)
    # A rust-red stool and notebook are recognizable again from the opposite end of the room.
    x,z=.96,.75
    for i in range(3):
        a=i*math.tau/3;d=P((math.cos(a),0,math.sin(a)))
        rod('Stool leg',P((x,.02,z))+d*.17,P((x,.44,z))+d*.126,.020,'oak')
    cyl('Stool cushion',(x,.46,z),.188,.055,'oxblood',28)
    book(x-.021,.492,z-.008,.116,.158,'deepTeal',.21)

def proof_actors():
    """Editable pose guides in the .blend. Live flippers, spring and ball come from the browser simulation."""
    collection('Preview • Runtime actors')
    for f in LAYOUT['flippers']:
        x,z,angle=f['x'],f['z'],f['rest'];start=P((x,deck(z),z))
        direction=P((math.cos(angle),0,math.sin(angle)));side=P((-direction.z,0,direction.x))
        length,r=f['length'],f['radius']
        outline=[]
        for i in range(15):
            a=-math.pi/2+math.pi*i/14
            outline.append(start+direction*(length+math.cos(a)*r*.72)+side*(math.sin(a)*r*.72))
        for i in range(15):
            a=math.pi/2+math.pi*i/14
            outline.append(start+direction*(math.cos(a)*r)+side*(math.sin(a)*r))
        for low,high,mat in [(.012,.027,'redRubber'),(.027,.044,'enamel')]:
            verts=[P((p.x,deck(p.z)+y,p.z)) for y in [low,high] for p in outline];n=len(outline)
            faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
            faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
            raw('Reference '+f['side']+' flipper',verts,faces,mat)
        screw(x,deck(z)+.046,z,.008)
    launcher=LAYOUT['launcher'];p=P(launcher['path'][0]);r=LAYOUT['ballRadius']
    profile=[(-r*math.cos(i*math.pi/18),max(.0001,r*math.sin(i*math.pi/18))) for i in range(19)]
    lathe('Resting chrome ball',p,profile,'steel',36)
    coil=[]
    for i in range(157):
        t=i/156;a=t*math.tau*12
        z=p.z+r+.145*t
        coil.append((p.x+math.cos(a)*.017,deck(z)+r+math.sin(a)*.017,z))
    tube('Resting launch spring',coil,.0033,'brassEdge',8)
    for station in ('projects','experience'):
        origin,axis,across=spring_axes(station);up=P((0,1,0))
        coil=[origin+axis*(.027+.114*i/100)+.0123*(across*math.cos(i*math.tau/10)+up*math.sin(i*math.tau/10)) for i in range(101)]
        tube('Reference return coil',coil,.0022,'brassEdge',7)
        rod('Reference return shoe',origin+axis*.022,origin+axis*.029,.014,'enamel',20)
        rod('Reference pull shaft',origin+axis*.026,origin+axis*.194,.0037,'steel',10)
        rod('Reference plunger handle',origin+axis*.184,origin+axis*.210,.015,'oxblood',20)

def proof_camera_and_lights():
    collection('06 • Blender proof lighting and camera')
    world=bpy.data.worlds.new('Workshop blue hour');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.29,.36,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.29;scene.world=world
    def light(name,where,target,energy,size,color):
        data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color
        obj=attach(bpy.data.objects.new(name,data),where)
        obj.rotation_euler=(V(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    light('Amber overhead',(0,2.51,.45),(0,.94,0),105,1.45,(1,.79,.55))
    light('Window blue fill',(-.62,1.80,-2.15),(0,.90,0),79,1.42,(.53,.72,1))
    light('Camera-side warm bounce',(-1.35,1.62,1.53),(0,.95,0),53,1.1,(1,.84,.68))
    light('Green lamp',(-.457,1.26,-.619),(-.13,.94,-.26),12,.14,(1,.73,.39))
    light('Project reading lamp',(-2.148,1.19,-.80),(-1.98,.92,-.75),18,.20,(1,.72,.39))
    light('Letterpress task lamp',(2.51,1.46,-1.08),(1.82,1.15,-.90),36,.33,(1,.79,.51))
    data=bpy.data.cameras.new('Over the flippers');data.lens=32;data.sensor_width=36
    camera=attach(bpy.data.objects.new('Player-eye camera',data),(-.27,2.16,1.46))
    camera.rotation_euler=(V((.01,.94,.10))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=18
    scene.view_settings.exposure=-1.0
    scene.render.resolution_x=1440;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            region=area.spaces.active.region_3d
            region.view_perspective='CAMERA'
    scene['author']='Daniel Ryu • Midnight Signal Workshop'
    scene['dimensions']='Metres. Rail positions, ball size and pivots are shared with src/room-layout.json.'

def export_asset():
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ART/'workshop.blend'),compress=True)
    # The .blend keeps all objects separately editable. Only the delivery file is batched.
    preview=bpy.data.collections['Preview • Runtime actors']
    for o in list(preview.objects):bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.collections.remove(preview)
    bpy.context.view_layer.update()
    fixed={}
    for obj in list(scene.objects):
        if obj.type!='MESH' or obj.name=='Cabinet_Playfield' or obj.name.startswith('Bumper_bell-'):continue
        material=obj.material_slots[0].material
        fixed.setdefault((obj.parent,material),[]).append(obj)
    for (parent,mat),objects in fixed.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
            if obj.data.users>1:obj.data=obj.data.copy()
            obj.material_slots[0].link='DATA';obj.data.materials[0]=mat
        active=objects[0]
        bpy.context.view_layer.objects.active=active
        bpy.ops.object.join()
        active.name=(parent.name if parent else 'Room')+'__'+mat.name
    bpy.ops.object.select_all(action='DESELECT')
    output=MODELS/'workshop.glb'
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,
        export_lights=False,export_cameras=False,export_animations=False,export_extras=True,
        export_texcoords=True,export_normals=True,export_tangents=False)
    print('WORKSHOP_EXPORT',output,output.stat().st_size,flush=True)

if __name__=='__main__':
    cabinet();projects();archive();room()
    bake_contacts(scene,M,TEXTURES)
    brushed_bells(scene,M['bellBrass'],TEXTURES)
    proof_actors();proof_camera_and_lights();export_asset()
