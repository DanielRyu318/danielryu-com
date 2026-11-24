"""Short-range ambient occlusion for the enamel, worktops and floor.

This pass uses the authored meshes as occluders. Moving actors are added afterwards
so a shot, a flipped paddle or a swivelled monitor leaves no silhouette in the bake.
"""
import math

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def build_tree(scene):
    vertices, polygons = [], []
    for obj in scene.objects:
        parent_name=obj.parent.name if obj.parent else ''
        if obj.type != 'MESH' or parent_name in {'Projects_CRT_Swivel','Signal_Spinner'} or parent_name.startswith('Drop_'):
            continue
        start = len(vertices)
        vertices.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
        polygons.extend(tuple(start + i for i in face.vertices) for face in obj.data.polygons)
    return BVHTree.FromPolygons(vertices, polygons)


def occlusion(tree, bounds, dimensions, height, radius, strength):
    xmin, xmax, zmin, zmax = bounds
    w, h = dimensions
    output = np.empty((h, w), dtype=np.float32)
    golden = math.pi * (3 - math.sqrt(5))
    rays = []
    for i in range(30):
        azimuth, u = i * golden, (i + .5) / 30
        rays.append(Vector((math.cos(azimuth) * math.sqrt(u), math.sin(azimuth) * math.sqrt(u), math.sqrt(1-u))))
    cast = tree.ray_cast
    for j in range(h):
        z = zmax - (j + .5) * (zmax-zmin) / h
        y = height(z) + .0018
        for i in range(w):
            x = xmin + (i + .5) * (xmax-xmin) / w
            point = Vector((x, -z, y))
            weight = 0
            for direction in rays:
                distance = cast(point, direction, radius)[3]
                if distance is not None:
                    weight += (1-distance/radius)**1.45
            output[j,i] = 1-strength * weight / len(rays)
    # Gentle spatial filtering removes sampling roughness from the penumbra.
    outer = np.pad(output, 1, mode='edge')
    return (4*output + outer[1:-1,:-2] + outer[1:-1,2:] + outer[:-2,1:-1] + outer[2:,1:-1]) / 8


def gray_image(name, data, path):
    h,w = data.shape
    image=bpy.data.images.new(name,width=w,height=h,alpha=False)
    image.colorspace_settings.name='Non-Color'
    rgba=np.ones((h,w,4),dtype=np.float32);rgba[:,:,:3]=data[:,:,None]
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw=str(path);image.file_format='PNG';image.save()
    return image


def resize_gray(src,w,h):
    sy,sx=src.shape
    xs=(np.arange(w)+.5)*sx/w-.5
    ys=(np.arange(h)+.5)*sy/h-.5
    horizontal=np.array([np.interp(xs,np.arange(sx),row) for row in src])
    return np.array([np.interp(ys,np.arange(sy),col) for col in horizontal.T],dtype=np.float32).T


def bake_contacts(scene,materials,directory):
    bpy.context.view_layer.update()
    tree=build_tree(scene)
    deck=occlusion(tree,(-.52,.52,-.90,.90),(192,328),lambda z:.94-.065*z,.102,.82)
    gray_image('Enamel contact proof',deck,directory/'deck-contact.png')
    image_node=next(n for n in materials['field'].node_tree.nodes if n.type=='TEX_IMAGE')
    painted=image_node.image
    w,h=painted.size
    pixels=np.empty(w*h*4,dtype=np.float32);painted.pixels.foreach_get(pixels)
    pixels=pixels.reshape(h,w,4)
    # Keep the screen printing intact and colour only the diffuse contact penumbra.
    pixels[:,:,:3]*=resize_gray(deck,w,h)[:,:,None]**.77
    baked=painted.copy();baked.name='Midnight enamel – seated hardware'
    baked.pixels.foreach_set(np.ascontiguousarray(pixels).ravel())
    baked.filepath_raw=str(directory/'field-seated.jpg');baked.file_format='JPEG';baked.save()
    image_node.image=baked

    # Secondary UVs preserve the existing grain at its authored scale. Empty space in
    # the atlas stays white for surfaces sharing the same timber/plank materials.
    patches={
        'floor':((-3.39,3.39,-2.55,2.95),(256,208),(2,2),.006,.64,.87),
        'Writing desk':((-2.57,-1.03,-1.67,-.49),(168,128),(2,216),.90,.24,.81),
        'Archive workbench':((1.035,2.565,-1.518,-.438),(168,120),(174,216),.90,.24,.81),
    }
    width,height=352,352
    atlas=np.ones((height,width),dtype=np.float32)
    for bounds,(w,h),(u,v),level,radius,strength in patches.values():
        patch=occlusion(tree,bounds,(w,h),lambda _:level,radius,strength)
        atlas[v:v+h,u:u+w]=patch
    surface_map=gray_image('Workbench and floor contacts',atlas,directory/'room-contact.png')
    shader_group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
    shader_group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    active={materials[key] for key in ('woodGrain','floorA','floorB','floorC','floorD')}
    for material in active:
        nodes=material.node_tree.nodes;links=material.node_tree.links
        uv=nodes.new('ShaderNodeUVMap');uv.uv_map='Workshop contacts'
        texture=nodes.new('ShaderNodeTexImage');texture.image=surface_map
        separate=nodes.new('ShaderNodeSeparateColor')
        output=nodes.new('ShaderNodeGroup');output.node_tree=shader_group
        links.new(uv.outputs['UV'],texture.inputs['Vector'])
        links.new(texture.outputs['Color'],separate.inputs['Color'])
        links.new(separate.outputs['Red'],output.inputs['Occlusion'])
    for obj in scene.objects:
        if obj.type!='MESH' or obj.material_slots[0].material not in active:continue
        if obj.data.users>1:obj.data=obj.data.copy()
        uv=obj.data.uv_layers.new(name='Workshop contacts')
        obj.data.uv_layers.active=obj.data.uv_layers[0]
        obj.data.uv_layers[0].active_render=True
        key='floor' if obj.name.startswith('Waxed floorboard') else obj.name
        if key not in patches:
            uv.data.foreach_set('uv',np.tile((.99,.99),len(uv.data)).astype(np.float32));continue
        (xmin,xmax,zmin,zmax),(pw,ph),(u,v),*_=patches[key]
        values=[]
        for loop in obj.data.loops:
            pos=obj.matrix_world@obj.data.vertices[loop.vertex_index].co
            # Local image data and Blender UV both originate at the lower left.
            a=np.clip((pos.x-xmin)/(xmax-xmin),.001,.999)
            b=np.clip((zmax+pos.y)/(zmax-zmin),.001,.999)
            values.extend(((u+.5+a*(pw-1))/width,(v+.5+b*(ph-1))/height))
        uv.data.foreach_set('uv',np.array(values,dtype=np.float32))
    print('CONTACT_BAKE deck range:',float(deck.min()),float(deck.max()),flush=True)


def brushed_bells(scene,material,directory):
    # Fine circular tooling marks affect the reflection, leaving the cast brass colour intact.
    yy,xx=np.indices((120,192),dtype=np.float32)
    roughness=(.405+.037*np.cos(yy*1.7)+.023*np.sin(yy*.40+xx*.015)
               +.027*np.cos(xx*.036+np.sin(yy*.091))+.011*np.sin(xx*.77+yy*.64))
    metal=gray_image('Lathe-tool finish',roughness,directory/'turned-brass.png')
    nodes=material.node_tree.nodes;links=material.node_tree.links
    tex=nodes.new('ShaderNodeTexImage');tex.image=metal
    channels=nodes.new('ShaderNodeSeparateColor')
    links.new(tex.outputs['Color'],channels.inputs['Color'])
    links.new(channels.outputs['Green'],nodes['Principled BSDF'].inputs['Roughness'])
    for o in scene.objects:
        if o.type!='MESH' or o.material_slots[0].material!=material:continue
        mesh=o.data
        if mesh.uv_layers:continue
        uv=mesh.uv_layers.new(name='Turned bronze')
        low=min(v.co.z for v in mesh.vertices);high=max(v.co.z for v in mesh.vertices)
        for face in mesh.polygons:
            coords=[mesh.vertices[mesh.loops[i].vertex_index].co for i in face.loop_indices]
            us=[(math.atan2(-p.y,p.x)/math.tau)%1 for p in coords]
            crosses_seam=max(us)-min(us)>.5
            for loop,p,u in zip(face.loop_indices,coords,us):
                uv.data[loop].uv=(u+1 if crosses_seam and u<.5 else u,(p.z-low)/(high-low))
