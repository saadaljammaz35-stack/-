"""WARD TYPE Original — geometric outlines authored procedurally from scratch.
No font inputs. Output local TTF and WOFF2. Python 3.10+.
"""
from pathlib import Path
import argparse, math, unicodedata
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.ttLib import TTFont
from shapely.geometry import LineString, Polygon, Point, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

UPM=1000; B=105
WEIGHTS={'Light':(300,49),'Regular':(400,67),'Medium':(500,84),'Bold':(700,109),'Black':(900,135)}
# Path notation: explicit original coordinate skeletons. Q denotes quadratic curves.
def path(*commands):
    result=[]
    for c in commands:
        if len(c)==2: result.append(c)
        else:
            x0,y0=result[-1]; x1,y1,x2,y2=c
            result.extend(((1-t)**2*x0+2*t*(1-t)*x1+t*t*x2,(1-t)**2*y0+2*t*(1-t)*y1+t*t*y2) for t in [i/12 for i in range(1,13)])
    return result

def transform(p,dx=0,dy=0,sx=1,sy=1): return [(x*sx+dx,y*sy+dy) for x,y in p]
def stroke(p,t): return LineString(p).buffer(t/2,quad_segs=5,cap_style=1,join_style=1)
def dot(x,y,s): return Polygon([(x,y+s*.66),(x+s*.66,y),(x,y-s*.66),(x-s*.66,y)])
def glyph_name(ch): return 'uni%04X'%ord(ch)

def arabic(ch,form,t):
    # x runs left to right; Arabic joins enter at right and leave at left.
    core={'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ؤ':'و','ئ':'ي','ة':'ه','ى':'ي','پ':'ب','چ':'ج','ژ':'ز','گ':'ك','ڤ':'ف'}.get(ch,ch)
    R=form in ('fina','medi'); L=form in ('init','medi')
    P=[]; D=[]; b=B
    def s(*p): P.append(path(*p))
    def dots(n,x,y):
        d=max(68,t*.8); sep=max(103,t*.98)
        if n==1: D.append(dot(x,y,d))
        elif n==2: D.extend([dot(x-sep/2,y,d),dot(x+sep/2,y,d)])
        else: D.extend([dot(x-sep/2,y,d),dot(x+sep/2,y,d),dot(x,y+sep,d)])
    if core=='ا':
        w=260; x=105
        s((x,690),(x,b))
        if R:s((x,b),(w+8,b))
    elif core in 'بتثني':
        if L:
            w=315; x=170
            s((-8,b),(95,b),(x,b,x,187),(x,280))
            if R:s((x,187),(x,b,245,b),(w+8,b))
            center=x
        elif core in 'ي' and ch!='ئ':
            w=635; center=310
            s((470,350),(540,350,540,260),(540,145,400,112),(235,85),(120,65,120,-65),(120,-155,285,-155),(450,-155))
            if R:s((540,260),(540,b,635,b),(w+8,b))
        elif core=='ن':
            w=540; center=270
            s((110,218),(110,65,170,-15),(240,-65),(370,-65,425,35),(425,b))
            if R:s((425,b),(w+8,b))
            else:s((425,b),(425,255))
        else:
            w=650; center=325
            s((85,245),(85,b,195,b),(460,b),(565,b,565,240))
            if R:s((565,160),(565,b,625,b),(w+8,b))
        if ch in 'ب':dots(1,center,-12 if not L else -40)
        if ch in 'ت':dots(2,center,410 if L else 365)
        if ch in 'ث':dots(3,center,410 if L else 365)
        if ch=='ن':dots(1,center,385 if L else 310)
        if ch=='ي':dots(2,center,-275 if not L else -42)
        if ch=='پ':dots(3,center,-195 if L else -190)
    elif core in 'جحخ':
        w=520 if L else 650; x=250 if L else 320
        s((95 if L else 135,310),(220,400,380,320),(440,285),(390,210,270,165),(170,b))
        if L:s((170,b),(-8,b))
        else:s((170,b),(88,45,88,-75),(88,-205,270,-205),(500,-205))
        if R:s((270,165),(430,b),(w+8,b))
        if ch=='ج':dots(1,x,-38 if L else -85)
        if ch=='خ':dots(1,x,475)
        if ch=='چ':dots(3,x,-175 if L else -125)
    elif core in 'دذ':
        w=415
        s((80,b),(260,b),(330,b,315,205),(295,315),(205,400))
        if R:s((275,b),(w+8,b))
        if ch=='ذ':dots(1,240,515)
    elif core in 'رز':
        w=365
        s((85,-145),(280,-125,280,50),(280,265))
        if R:s((280,175),(280,b,365,b),(w+8,b))
        if ch=='ز':dots(1,275,415)
        if ch=='ژ':dots(3,225,420)
    elif core in 'سش':
        w=600 if L else 800; shift=0 if L else 200
        s((shift+70,265),(shift+70,110,shift+135,b),(shift+190,b,shift+190,255),(shift+190,280))
        s((shift+190,200),(shift+190,b,shift+265,b),(shift+335,b,shift+335,260),(shift+335,300))
        s((shift+335,210),(shift+335,b,shift+410,b),(shift+480,b,shift+480,265),(shift+480,325))
        if L:s((-8,b),(shift+70,b),(shift+70,170))
        else:s((shift+70,190),(shift+70,-65,180,-65),(85,-65,85,125),(85,225))
        if R:s((shift+480,190),(shift+480,b,shift+580,b),(w+8,b))
        if ch=='ش':dots(3,shift+270,415)
    elif core in 'صض':
        w=645 if L else 855; shift=0 if L else 210
        s((shift+135,b),(shift+230,320,shift+410,320),(shift+505,320,shift+505,215),(shift+505,b,shift+395,b),(shift+135,b))
        if L:s((-8,b),(shift+135,b))
        else:s((shift+135,b),(shift+110,-75,190,-75),(80,-75,80,100),(80,225))
        if R:s((shift+470,b),(w+8,b))
        if ch=='ض':dots(1,shift+380,475)
    elif core in 'طظ':
        w=600
        s((75,b),(75,690));s((75,b),(220,320,395,320),(485,320,485,210),(485,b,380,b),(75,b))
        if L:s((-8,b),(75,b))
        if R:s((485,b),(w+8,b))
        if ch=='ظ':dots(1,365,480)
    elif core in 'عغ':
        w=465 if L else 580
        if form=='medi':
            s((-8,b),(130,b),(360,310),(205,360),(100,260),(310,b),(w+8,b))
        elif L:
            s((-8,b),(140,b),(110,175,145,285),(215,380,350,305))
        else:
            s((345,345),(135,400,135,250),(135,180,270,180),(385,180),(135,130,95,-15),(95,-200,260,-200),(470,-200))
            if R:s((270,180),(390,b),(w+8,b))
        if ch=='غ':dots(1,240,485)
    elif core in 'فقو':
        w=(405 if L else (690 if core=='ف' else 520)) if core!='و' else 400
        x=235 if L or core=='و' else w-195
        s((x,b),(x-110,b,x-110,220),(x-110,335,x,335),(x+110,335,x+110,220),(x+110,b,x,b))
        if L:s((-8,b),(x,b))
        elif core=='ف':s((x,b),(210,b),(85,b,85,235))
        elif core=='ق':s((x+110,180),(x+110,-110,270,-110),(90,-110,90,80),(90,155))
        else:s((x+110,190),(x+110,-100,100,-155))
        if R:s((x+110,b),(w+8,b))
        if ch=='ف':dots(1,x,475)
        if ch=='ق':dots(2,x,475)
        if ch=='ڤ':dots(3,x,475)
    elif core=='ك':
        w=455 if L else 640
        if L:
            s((-8,b),(260,b),(320,b,300,210),(165,370),(365,600))
            if R:s((260,b),(w+8,b))
        else:
            s((90,245),(90,b,200,b),(w-100,b),(w-100,690))
            s((250,220),(340,280),(245,365),(360,460))
            if R:s((w-100,b),(w+8,b))
        if ch=='گ':s((190,530),(330,675))
    elif core=='ل':
        w=285 if L else 525; x=w-110
        s((x,690),(x,140),(x,b))
        if L:s((-8,b),(x,b))
        else:s((x,b),(x,-45,260,-45),(95,-45,95,100),(95,245))
        if R:s((x,b),(w+8,b))
    elif core=='م':
        w=450 if L else 475
        s((180,b),(105,b,105,205),(105,305,210,305),(315,305,315,205),(315,b,210,b),(180,b))
        if L:s((-8,b),(180,b))
        else:s((180,b),(100,b,100,-30),(100,-200))
        if R:s((315,b),(w+8,b))
    elif core=='ه':
        w=415 if L else 470
        if form=='medi':
            s((-8,b),(100,b),(100,285,205,285),(315,285,315,b),(w+8,b));s((100,b),(100,-110,205,-110),(315,-110,315,b),(100,b))
        elif L:
            s((-8,b),(100,b),(100,320,235,320),(340,320,340,215),(340,b,235,b),(140,b),(140,240,265,240),(335,240))
        else:
            s((95,b),(95,215,245,350),(395,215,395,b),(95,b))
            if R:s((395,b),(w+8,b))
        if ch=='ة':dots(2,245,475)
    elif ch=='ء':
        w=360;s((275,340),(85,380,85,235),(85,155,200,155),(295,155));s((200,155),(75,80))
    elif ch=='ـ':
        w=240;s((-8,b),(w+8,b))
    else: raise ValueError(ch)
    if ch in 'أإؤئ':
        x=(110 if ch in 'أإ' else w*.52); y=790 if ch=='أ' else (-95 if ch=='إ' else 430)
        P.append(path((x+55,y+45),(x-50,y+65,x-50,y),(x-50,y-20,x+10,y-20),(x+58,y-20),(x-55,y-75)))
    if ch=='آ':s((40,805),(90,840,145,805),(195,775,235,825))
    if ch=='ٱ':s((40,790),(180,790))
    return w,unary_union([stroke(p,t) for p in P]+D)

# Latin forms are independent geometric stroke constructions, not imported outlines.
LAT={
'A':(580,[[(75,80),(290,690),(505,80)],[(150,300),(430,300)]]),'B':(570,[[(90,80),(90,690),(320,690),(480,690,480,545),(480,390,320,390),(90,390)],[(320,390),(505,390,505,235),(505,80,320,80),(90,80)]]),'C':(600,[[(515,620),(425,690,300,690),(90,690,90,385),(90,80,300,80),(435,80,515,150)]]),'D':(620,[[(90,80),(90,690),(280,690),(530,690,530,385),(530,80,280,80),(90,80)]]),'E':(530,[[(450,690),(90,690),(90,80),(450,80)],[(90,390),(405,390)]]),'F':(530,[[(90,80),(90,690),(450,690)],[(90,390),(405,390)]]),'G':(630,[[(540,620),(450,690,300,690),(90,690,90,385),(90,80,300,80),(540,80,540,280),(540,355),(315,355)]]),'H':(620,[[(90,80),(90,690)],[(530,80),(530,690)],[(90,390),(530,390)]]),'I':(230,[[(115,80),(115,690)]]),'J':(490,[[(400,690),(400,260),(400,80,240,80),(80,80,80,245)]]),'K':(580,[[(90,80),(90,690)],[(500,690),(90,320)],[(270,480),(510,80)]]),'L':(490,[[(90,690),(90,80),(415,80)]]),'M':(750,[[(90,80),(90,690),(375,300),(660,690),(660,80)]]),'N':(620,[[(90,80),(90,690),(530,80),(530,690)]]),'O':(650,[[(325,690),(90,690,90,385),(90,80,325,80),(560,80,560,385),(560,690,325,690)]]),'P':(555,[[(90,80),(90,690),(310,690),(470,690,470,520),(470,355,310,355),(90,355)]]),'Q':(650,[[(325,690),(90,690,90,385),(90,80,325,80),(560,80,560,385),(560,690,325,690)],[(380,220),(580,30)]]),'R':(570,[[(90,80),(90,690),(310,690),(485,690,485,520),(485,355,310,355),(90,355)],[(310,355),(500,80)]]),'S':(555,[[(470,610),(380,690,270,690),(90,690,90,535),(90,425,270,390),(475,355,475,215),(475,80,280,80),(165,80,80,160)]]),'T':(560,[[(70,690),(490,690)],[(280,690),(280,80)]]),'U':(620,[[(90,690),(90,285),(90,80,310,80),(530,80,530,285),(530,690)]]),'V':(580,[[(75,690),(290,80),(505,690)]]),'W':(820,[[(75,690),(245,80),(410,500),(575,80),(745,690)]]),'X':(580,[[(75,690),(505,80)],[(505,690),(75,80)]]),'Y':(580,[[(75,690),(290,365),(505,690)],[(290,365),(290,80)]]),'Z':(560,[[(80,690),(480,690),(80,80),(480,80)]]),
'0':(540,[[(270,690),(90,690,90,385),(90,80,270,80),(450,80,450,385),(450,690,270,690)]]),'1':(360,[[(70,555),(200,690),(200,80)]]),'2':(540,[[(90,545),(90,690,270,690),(450,690,450,535),(450,410,90,80),(460,80)]]),'3':(540,[[(90,620),(170,690,280,690),(450,690,450,540),(450,390,270,390),(450,390,450,235),(450,80,280,80),(170,80,90,150)]]),'4':(560,[[(375,690),(80,285),(485,285)],[(375,690),(375,80)]]),'5':(540,[[(455,690),(105,690),(105,410),(270,430,450,350),(450,80,270,80),(150,80,90,150)]]),'6':(540,[[(420,660),(100,720,90,340),(90,80,270,80),(450,80,450,250),(450,420,270,420),(90,420,90,250)]]),'7':(540,[[(85,690),(455,690),(185,80)]]),'8':(540,[[(270,690),(90,690,90,540),(90,390,270,390),(450,390,450,540),(450,690,270,690)],[(270,390),(90,390,90,235),(90,80,270,80),(450,80,450,235),(450,390,270,390)]]),'9':(540,[[(120,110),(440,50,450,430),(450,690,270,690),(90,690,90,520),(90,350,270,350),(450,350,450,520)]]),
'a':(510,[[(420,80),(420,485)],[(420,320),(420,485,255,485),(90,485,90,285),(90,80,255,80),(420,80,420,285)]]),'b':(510,[[(90,80),(90,690)],[(90,285),(90,485,255,485),(420,485,420,285),(420,80,255,80),(90,80,90,285)]]),'c':(480,[[(405,440),(335,485,250,485),(90,485,90,285),(90,80,250,80),(340,80,405,125)]]),'d':(510,[[(420,80),(420,690)],[(420,285),(420,485,255,485),(90,485,90,285),(90,80,255,80),(420,80,420,285)]]),'e':(510,[[(90,285),(420,285),(420,485,255,485),(90,485,90,285),(90,80,255,80),(350,80,420,125)]]),'f':(340,[[(125,80),(125,550),(125,690,260,690)],[(65,475),(285,475)]]),'g':(510,[[(420,485),(420,-25),(420,-160,255,-160),(150,-160,90,-115)],[(420,285),(420,485,255,485),(90,485,90,285),(90,80,255,80),(420,80,420,285)]]),'h':(510,[[(90,80),(90,690)],[(90,320),(90,485,255,485),(420,485,420,320),(420,80)]]),'i':(220,[[(110,80),(110,485)]]),'j':(240,[[(145,485),(145,-30),(145,-160,45,-160)]]),'k':(490,[[(90,80),(90,690)],[(410,485),(90,210)],[(235,335),(420,80)]]),'l':(220,[[(110,690),(110,80)]]),'m':(740,[[(90,80),(90,485)],[(90,325),(90,485,230,485),(370,485,370,325),(370,80)],[(370,325),(370,485,510,485),(650,485,650,325),(650,80)]]),'n':(510,[[(90,80),(90,485)],[(90,325),(90,485,255,485),(420,485,420,325),(420,80)]]),'o':(510,[[(255,485),(90,485,90,285),(90,80,255,80),(420,80,420,285),(420,485,255,485)]]),'p':(510,[[(90,-160),(90,485)],[(90,285),(90,485,255,485),(420,485,420,285),(420,80,255,80),(90,80,90,285)]]),'q':(510,[[(420,-160),(420,485)],[(420,285),(420,485,255,485),(90,485,90,285),(90,80,255,80),(420,80,420,285)]]),'r':(345,[[(90,80),(90,485)],[(90,325),(90,485,270,485)]]),'s':(450,[[(375,430),(310,485,220,485),(90,485,90,380),(90,305,220,285),(375,265,375,170),(375,80,220,80),(140,80,75,125)]]),'t':(350,[[(130,650),(130,200),(130,80,275,80)],[(65,475),(285,475)]]),'u':(510,[[(90,485),(90,245),(90,80,255,80),(420,80,420,245),(420,485)],[(420,245),(420,80)]]),'v':(480,[[(75,485),(240,80),(405,485)]]),'w':(690,[[(75,485),(210,80),(345,400),(480,80),(615,485)]]),'x':(480,[[(75,485),(405,80)],[(405,485),(75,80)]]),'y':(480,[[(75,485),(240,80)],[(405,485),(185,-160)]]),'z':(460,[[(75,485),(385,485),(75,80),(385,80)]])}

def latin(ch,t):
    w,paths=LAT[ch]; parts=[stroke(path(*p),t) for p in paths]
    if ch in 'ij':parts.append(dot(110 if ch=='i' else 145,630,max(70,t*.85)))
    return w,unary_union(parts)

AR_DIG={ '٠':(230,[[(115,365),(115,367)]]),'١':(255,[[(125,80),(125,690)]]),'٢':(440,[[(100,690),(100,520,225,520),(350,520,350,690),(350,80)]]),'٣':(570,[[(90,690),(90,520,185,520),(280,520,280,690),(280,520,375,520),(470,520,470,690),(470,80)]]),'٤':(465,[[(370,690),(115,500),(345,365),(115,80),(380,80)]]),'٥':(520,[[(260,690),(95,500,95,300),(95,80,260,80),(425,80,425,300),(425,500,260,690)]]),'٦':(470,[[(80,690),(380,690),(380,80)]]),'٧':(520,[[(85,690),(260,80),(435,690)]]),'٨':(520,[[(85,80),(260,690),(435,80)]]),'٩':(490,[[(390,80),(390,510),(390,690,245,690),(100,690,100,510),(100,350,245,350),(390,350,390,510)]]) }

def simple(ch,t):
    if ch in AR_DIG:
        w,ps=AR_DIG[ch]
        return w,unary_union([stroke(path(*p),t) for p in ps])
    w=300; p=[]; ds=[]
    def s(*p0):p.append(stroke(path(*p0),t))
    d=max(62,t*.75)
    if ch in '.:;؛,،':
        ds.append(dot(150,110,d))
        if ch in ':;؛':ds.append(dot(150,400,d))
        if ch in ',،;؛':s((165,125),(95,-55))
    elif ch in '!?؟':
        if ch=='!':s((150,690),(150,265))
        else:
            w=470; s((85,545),(85,690,235,690),(385,690,385,545),(385,420,235,355),(235,270))
            if ch=='؟':p=[__import__('shapely').affinity.scale(v,xfact=-1,yfact=1,origin=(235,0)) for v in p]
        ds.append(dot(w/2,110,d))
    elif ch in '-–—_':
        w={'-':350,'–':500,'—':750,'_':480}[ch]; y=0 if ch=='_' else 315;s((70,y),(w-70,y))
    elif ch in '()[]':
        w=300;s((210,720),(85,445,85,280),(85,50,210,-120))
        if ch in ')]':p=[__import__('shapely').affinity.scale(v,xfact=-1,yfact=1,origin=(150,0)) for v in p]
    elif ch in '/\\':w=420;s((75,40),(345,710))
    elif ch in '«»':
        w=400;s((180,450),(85,285),(180,120));s((315,450),(220,285),(315,120))
        if ch=='»':p=[__import__('shapely').affinity.scale(v,xfact=-1,yfact=1,origin=(200,0)) for v in p]
    elif ch in '\"\'':
        w=280;s((100,690),(100,550));
        if ch=='\"':s((200,690),(200,550))
    elif ch in '+=':
        w=480;s((80,360),(400,360));
        if ch=='+':s((240,520),(240,200))
        else:s((80,200),(400,200))
    elif ch=='%':w=650;s((100,80),(550,690));ds.extend([Point(155,550).buffer(70),Point(495,210).buffer(70)])
    elif ch=='…':w=500;ds.extend([dot(x,105,d) for x in (100,250,400)])
    else: return 300,Polygon()
    return w,unary_union(p+ds)

MARKS={'َ':(False,[[( -65,60),(65,130)]]),'ُ':(False,[[(0,50),(60,120),(60,175,0,175),(-50,175,-50,125),(-50,80,0,80),(60,80)]]),'ِ':(True,[[(-65,-90),(65,-20)]]),'ً':(False,[[(-65,40),(65,110)],[(-65,140),(65,210)]]),'ٌ':(False,[[(-40,45),(50,110),(50,170,-5,170),(-55,170,-55,115),(-55,80,0,80)],[(-70,225),(70,225)]]),'ٍ':(True,[[(-65,-90),(65,-20)],[(-65,-190),(65,-120)]]),'ْ':(False,[[(-60,100),(-60,165,0,165),(60,165,60,100),(60,40,0,40),(-60,40,-60,100)]]),'ّ':(False,[[(-100,150),(-100,50,-50,50),(0,50,0,150),(0,50,50,50),(100,50,100,150)]]),'ٰ':(False,[[(0,35),(0,200)]])}

def outline(g):
    pen=TTGlyphPen(None)
    if not g.is_empty:
        polys=[g] if g.geom_type=='Polygon' else [p for p in g.geoms if p.geom_type=='Polygon']
        for poly in polys:
            poly=orient(poly,sign=-1.0)
            for ring in [poly.exterior,*poly.interiors]:
                pts=list(dict.fromkeys([(round(x),round(y)) for x,y in list(ring.coords)[:-1]]))
                if len(pts)<3:continue
                pen.moveTo(pts[0]); [pen.lineTo(p) for p in pts[1:]];pen.closePath()
    return pen.glyph()

def build(weight,out):
    value,t=WEIGHTS[weight]; gly={}; metrics={}; cmap={}; anchors={}; marks={}; substitutions={a:[] for a in ['init','medi','fina']}; ligs=[]
    def put(n,w,g,anchor=True):
        gly[n]=outline(g); metrics[n]=(w,round(g.bounds[0]) if not g.is_empty else 0)
        if anchor and not g.is_empty: anchors[n]=(int(w/2),int(g.bounds[3]+35),int(g.bounds[1]-25))
    put('.notdef',500,box(60,0,440,650).difference(box(110,50,390,600)),False)
    put('space',300,Polygon(),False); cmap[32]='space'; cmap[160]='space'
    for ch in 'ابتثجحخدذرزسشصضطظعغفقكلمنهويأإآٱؤئءةىپچژگڤـ':
        n=glyph_name(ch);cmap[ord(ch)]=n
        forms=['isol'] if ch in 'ءـ' else ['isol','fina'] if ch in 'اأإآٱدذرزوؤةژ' else ['isol','fina','init','medi']
        for f in forms:
            w,g=arabic(ch,f,t); gn=n if f=='isol' else n+'.'+f;put(gn,w,g)
            if f!='isol': substitutions[f].append(f'sub {n} by {gn};')
    # Required lam-alef ligatures with isolated and right-joining forms.
    for alef in 'اأإآ':
        for f in ['isol','fina']:
            n='lamalef'+glyph_name(alef)+'.'+f; w=565
            pp=[path((105,690),(430,105)),path((435,690),(435,200),(435,105,330,105),(90,105))]
            if f=='fina': pp.append(path((435,105),(w+8,105)))
            if alef=='آ':pp.append(path((55,805),(105,845,160,805)))
            elif alef in 'أإ':
                y=790 if alef=='أ' else -65; pp.append(path((150,y+50),(55,y+65,55,y),(55,y-20,145,y-20),(45,y-75)))
            put(n,w,unary_union([stroke(p,t) for p in pp]))
            ligs.append(f'sub {glyph_name("ل")}.{ "init" if f=="isol" else "medi"} {glyph_name(alef)}.fina by {n};')
    for ch in LAT:
        n=glyph_name(ch);cmap[ord(ch)]=n; w,g=latin(ch,t);put(n,w,g)
    for ch in ''.join(AR_DIG)+'.:;؛,،!?؟-–—_()[]/\\«»\"\'+=%…':
        n=glyph_name(ch);cmap[ord(ch)]=n;w,g=simple(ch,t);put(n,w,g)
    for ch,(below,paths) in MARKS.items():
        n=glyph_name(ch);cmap[ord(ch)]=n;put(n,0,unary_union([stroke(path(*p),max(25,t*.46)) for p in paths]),False);marks[n]=below
    fb=FontBuilder(UPM,isTTF=True);fb.setupGlyphOrder(list(gly));fb.setupCharacterMap(cmap);fb.setupGlyf(gly);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=1080,descent=-400);fb.setupNameTable({'familyName':'WARD Type Original','styleName':weight,'uniqueFontIdentifier':'WARD.Type.Original.0.1.'+weight,'fullName':'WARD Type Original '+weight,'psName':'WARDTypeOriginal-'+weight,'version':'Version 0.1','designer':'WARD design project','description':'Original procedural geometric outlines; prototype.'});fb.setupOS2(sTypoAscender=1080,sTypoDescender=-400,sTypoLineGap=0,usWinAscent=1100,usWinDescent=420,usWeightClass=value,fsSelection=32 if weight=='Bold' else 64 if weight=='Regular' else 0);fb.setupPost();
    if weight=='Bold':fb.font['head'].macStyle=1
    fea='languagesystem DFLT dflt; languagesystem arab dflt; languagesystem latn dflt;\n'
    for f,ss in substitutions.items():fea+=f'feature {f} {{ '+ ' '.join(ss)+f' }} {f};\n'
    fea+='feature rlig { '+' '.join(ligs)+' } rlig;\n'
    for n,below in marks.items():fea+=f'markClass {n} <anchor 0 0> @MC{"Below" if below else "Above"};\n'
    fea+='feature mark {\n'
    for n,(x,y,z) in anchors.items():fea+=f'pos base {n} <anchor {x} {y}> mark @MCAbove <anchor {x} {z}> mark @MCBelow;\n'
    fea+='} mark;\n'
    addOpenTypeFeaturesFromString(fb.font,fea)
    target=out/f'WARDTypeOriginal-{weight}.ttf';fb.save(target)
    ft=TTFont(target);ft.flavor='woff2';ft.save(target.with_suffix('.woff2'))
    print(weight,len(gly),'glyphs',len(cmap),'characters')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='dist');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    for name in WEIGHTS:build(name,out)
