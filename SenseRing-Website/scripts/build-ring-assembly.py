"""Website-only coloured assembly. Uses existing CAD datums; never changes print files."""
from pathlib import Path
import json, math

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'assets/ring-mesh.json'
P=json.loads(SOURCE.read_text())['parameters']
parts=[]
COLORS={'pcb':(0.075,0.09,0.085),'gold':(0.77,0.57,0.24),'silver':(0.71,0.74,0.76),'black':(0.035,0.04,0.045),'white':(0.88,0.88,0.84),'red':(0.65,0.095,0.12),'yellow':(0.86,0.62,0.16),'lead_red':(0.65,0.04,0.05)}

def add(name,vertices,triangles,color,group,metal=0.0):
    parts.append({'name':name,'vertices':vertices,'triangles':triangles,'color':list(COLORS.get(color,color)),'group':group,'metal':metal})

def solid(name,w,l,h,x,y,z,color,group,r=0.0,transform=None,metal=0.0):
    if r:
        polygon=[]
        for cx,cy,start in [(w/2-r,l/2-r,0),(-w/2+r,l/2-r,90),(-w/2+r,-l/2+r,180),(w/2-r,-l/2+r,270)]:
            for j in range(5):
                a=math.radians(start+j*22.5);polygon.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    else: polygon=[(-w/2,-l/2),(w/2,-l/2),(w/2,l/2),(-w/2,l/2)]
    n=len(polygon);v=[[u+x,t+y,z] for u,t in polygon]+[[u+x,t+y,z+h] for u,t in polygon]+[[x,y,z],[x,y,z+h]]
    f=[]
    for i in range(n):
        j=(i+1)%n;f += [[2*n,j,i],[2*n+1,i+n,j+n],[i,j,j+n],[i,j+n,i+n]]
    if transform:v=[transform(point) for point in v]
    add(name,v,f,color,group,metal)

def cylinder(name,r,h,x,y,z,color,group,transform=None,metal=0.0,n=20):
    p=[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n)) for i in range(n)]
    v=[[u+x,t+y,z] for u,t in p]+[[u+x,t+y,z+h] for u,t in p]+[[x,y,z],[x,y,z+h]];f=[]
    for i in range(n):
        j=(i+1)%n;f += [[2*n,j,i],[2*n+1,i+n,j+n],[i,j,j+n],[i,j+n,i+n]]
    if transform:v=[transform(point) for point in v]
    add(name,v,f,color,group,metal)

def wire(name,points,color,r=.18):
    for i,(a,b) in enumerate(zip(points,points[1:])):
        d=[b[k]-a[k] for k in range(3)];length=math.sqrt(sum(q*q for q in d));d=[q/length for q in d]
        up=[0,0,1] if abs(d[2])<.9 else [0,1,0]
        u=[d[1]*up[2]-d[2]*up[1],d[2]*up[0]-d[0]*up[2],d[0]*up[1]-d[1]*up[0]]
        norm=math.sqrt(sum(q*q for q in u));u=[q/norm for q in u]
        v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]]
        def t(p,a=a,u=u,v=v,d=d):return[a[k]+u[k]*p[0]+v[k]*p[1]+d[k]*p[2] for k in range(3)]
        cylinder(name+str(i),r,length,0,0,0,color,'battery',t,n=8)

def build():
    source=json.loads(SOURCE.read_text())
    for part in source['parts']:
        part={**part,'color':[.43,.46,.48] if part['name']=='ring_base' else [.72,.74,.77],
              'group':part['name'],'metal':.55 if part['name']!='ring_base' else .2}
        parts.append(part)
    bz=P['board_bottom_z'];top=bz+P['pcb_thickness_assumed']
    solid('XIAO board',P['board_width'],P['board_length'],1,0,0,bz,'pcb','controller',.85)
    for side in [-1,1]:
        for j in range(7):
            y=(j-3)*2.54
            solid('castellated pad',1.55,1.65,.08,side*8.12,y,top,'gold','controller',.32,metal=.7)
            cylinder('pad hole',.28,.04,side*8.55,y,top+.09,'black','controller',n=12)
    solid('RF shield',12.1,10.8,2.85,0,2.25,top,'silver','controller',.45,metal=.85)
    solid('shield label',10.9,9.2,.025,0,2.25,top+2.86,'white','controller',.3)
    # Physical label print is represented with dark compact linework, not invented product text.
    for w,y in [(7.6,5.2),(6.0,3.8),(8.2,2.5),(5.6,.3)]:solid('shield print',w,.18,.015,0,y,top+2.89,'black','controller')
    solid('USB C shell',9,7.5,3.3,0,-6.95,top,'silver','controller',.5,metal=.95)
    solid('USB C opening',7.7,.055,2.2,0,-10.73,top+.55,'black','controller',.0)
    solid('USB C tongue',5.8,.10,.42,0,-10.77,top+1.1,'pcb','controller')
    for i in range(8):solid('USB contact',.22,.12,.04,(i-3.5)*.55,-10.82,top+1.53,'gold','controller',metal=.8)
    for x in [-4.8,4.8]:
        solid('board switch',3.1,2.9,.9,x,8.25,top,'silver','controller',.2,metal=.7)
        cylinder('board switch actuator',.73,.35,x,8.25,top+.9,'black','controller')
    cylinder('antenna connector',.9,.7,0,8.25,top,'gold','controller',metal=.9)
    cylinder('antenna centre',.38,.05,0,8.25,top+.72,'silver','controller',metal=.8)
    for x,y in [(-5.8,-3),(5.8,-3),(-3.8,-3.8),(3.8,-3.8)]:solid('surface component',1.2,.8,.4,x,y,top,'black','controller',.1)

    # Sensor face lies in YZ, at the right-hand bezel, as in the existing CAD.
    tx=P['touch_pcb_inner_x'];tz=P['touch_center_z']
    face=lambda p:[tx+p[2],p[0],tz+p[1]]
    solid('TTP223 red board',15,11,1,0,0,0,'red','touch',.55,face)
    for u in [-4.8,5.8]:solid('touch outline',.13,7.6,.018,u,0,1.02,'white','touch',transform=face)
    for v in [-3.8,3.8]:solid('touch outline',10.6,.13,.018,.5,v,1.02,'white','touch',transform=face)
    # Fine concentric print depicts the standard module's sensing mark.
    for rr in [1.0,1.5,2.0]:
        for j in range(18):
            a=j*math.pi/18+.35;b=(j+1)*math.pi/18+.35
            u=.5+rr*math.cos(a);v=rr*math.sin(a)-.7
            solid('touch print',.10,.13,.02,u,v,1.04,'white','touch',transform=face)
    for v in [-2.8,0,2.8]:
        solid('touch solder pad',2.0,1.7,.04,-6.1,v,1.02,'gold','touch',.25,face,.7)
        cylinder('touch pad hole',.3,.025,-6.1,v,1.07,'black','touch',face,n=12)
    solid('touch IC',3.0,1.65,1.1,.5,0,-1.1,'black','touch',.1,face)
    for u in [-.5,.5,1.5]:
        for v in [-1.05,1.05]:solid('touch IC leg',.35,.45,.15,u,v,-.3,'silver','touch',transform=face,metal=.7)
    for u in [-3.5,4.3]:solid('touch resistor',1.3,.65,.45,u,-2,-.45,'black','touch',transform=face)

    bx=P['battery_inner_x']-4;bc=P['battery_center_z']
    pouch=lambda p:[bx+p[2],p[0],bc+p[1]]
    solid('160mAh pouch',20,10,4,0,0,0,'silver','battery',.6,pouch,.7)
    solid('pouch seam',20.4,.28,4.04,0,-4.78,-.02,'silver','battery',transform=pouch,metal=.75)
    solid('yellow insulation',3.1,10.1,4.08,-8.25,0,-.04,'yellow','battery',.3,pouch)
    wire('red insulated lead',[[-16,-10,4.2],[-16,-11.8,4.5],[-13,-13,8],[-9,-13,13.8]],'lead_red')
    wire('black insulated lead',[[-16.5,-10,1.2],[-16.5,-11.8,.5],[-13.5,-13.4,7.5],[-8,-13.4,13.8]],'black')

    a=P['outer_half_width'];b=P['outer_half_height'];c=P['profile_center_z'];theta=math.radians(P['button_profile_angle_degrees'])
    nx=math.cos(theta)/a;nz=math.sin(theta)/b;norm=math.hypot(nx,nz);nx/=norm;nz/=norm
    sx=a*math.cos(theta)-nx*(2.5-P['button_protrusion']);sz=c+b*math.sin(theta)-nz*(2.5-P['button_protrusion'])
    local_x=nz*sx-nx*sz;seat=nx*sx+nz*sz
    rotate=lambda p:[nz*p[0]+nx*p[2],p[1],-nx*p[0]+nz*p[2]]
    solid('tactile base',6,6,1.4,local_x,0,seat,'black','button',.3,rotate)
    solid('tactile metal top',5.8,5.8,.6,local_x,0,seat+1.4,'silver','button',.25,rotate,.75)
    cylinder('tactile actuator',1.35,.5,local_x,0,seat+2,'black','button',rotate)
    for x in [-3.2,3.2]:
        for y in [-1.8,1.8]:solid('button terminal',1.25,.65,.25,local_x+x,y,seat+.15,'silver','button',transform=rotate,metal=.8)
    solid('button fifth terminal',.75,1.0,.25,local_x,-3.1,seat+.15,'silver','button',transform=rotate,metal=.8)

    # Batch by material and moving group, preserving all model coordinates.
    merged={}
    for part in parts:
        key=(part['group'],tuple(part['color']),part['metal'])
        entry=merged.setdefault(key,{'name':part['group'],'group':part['group'],'color':part['color'],'metal':part['metal'],'vertices':[],'triangles':[]})
        offset=len(entry['vertices']);entry['vertices'] += part['vertices'];entry['triangles'] += [[q+offset for q in f] for f in part['triangles']]
    output={'units':'mm','parameters':P,'parts':list(merged.values()),'componentPlacement':'Existing v4 CAD datums; appearance follows confirmed red TTP223, official XIAO board image and supplied battery photo. Minute board print/passive layout is illustrative.'}
    for entry in output['parts']:entry['vertices']=[[round(q,4) for q in v] for v in entry['vertices']]
    target=ROOT/'assets/ring-assembly.json';target.write_text(json.dumps(output,separators=(',',':')),encoding='utf-8')
    print(f'{len(parts)} detailed parts, {len(merged)} render batches; {target.stat().st_size:,} bytes. Print models unchanged.')

if __name__=='__main__':build()
