package com.ls400.toolbox;

import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

public final class LS400Renderer implements GLSurfaceView.Renderer {
    private static final int LANDMARK=0, AC=1, HIGH=2, LOW=3, SHAPE_BOX=0, SHAPE_CYLINDER=1;
    private final Consumer<String> info;
    private final List<Part> parts=new ArrayList<>();
    private final List<Part> decor=new ArrayList<>();
    private final List<Route> routes=new ArrayList<>();
    private final float[] projection=new float[16],view=new float[16],vp=new float[16],model=new float[16],mvp=new float[16];
    private FloatBuffer cube, cylinder, lineBuffer;
    private int cylinderVertices;
    private int program,posLoc,colorLoc,mvpLoc,width,height,filter=0;
    private float yaw=0f,pitch=23f,distance=4.8f;
    private volatile float pickX=-1,pickY=-1;
    private Part selected;

    private static final float[] CUBE={
        -1,-1,-1, 1,-1,-1, 1,1,-1, -1,-1,-1, 1,1,-1,-1,1,-1,
        -1,-1, 1, 1,1, 1, 1,-1,1, -1,-1,1,-1,1,1,1,1,1,
        -1,-1,-1,-1,1,-1,-1,1,1, -1,-1,-1,-1,1,1,-1,-1,1,
         1,-1,-1, 1,-1,1, 1,1,1, 1,-1,-1,1,1,1,1,1,-1,
        -1,1,-1, 1,1,-1, 1,1,1, -1,1,-1,1,1,1,-1,1,1,
        -1,-1,-1, 1,-1,1, 1,-1,-1, -1,-1,-1,-1,-1,1,1,-1,1
    };

    public LS400Renderer(Consumer<String> info){ this.info=info; buildModel(); }

    @Override public void onSurfaceCreated(GL10 gl,EGLConfig config){
        GLES20.glClearColor(.025f,.055f,.075f,1); GLES20.glEnable(GLES20.GL_DEPTH_TEST); GLES20.glEnable(GLES20.GL_BLEND); GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA,GLES20.GL_ONE_MINUS_SRC_ALPHA);
        String vs="uniform mat4 uMVP; attribute vec3 aPos; void main(){gl_Position=uMVP*vec4(aPos,1.0);}";
        String fs="precision mediump float; uniform vec4 uColor; void main(){gl_FragColor=uColor;}";
        program=link(vs,fs); posLoc=GLES20.glGetAttribLocation(program,"aPos"); colorLoc=GLES20.glGetUniformLocation(program,"uColor"); mvpLoc=GLES20.glGetUniformLocation(program,"uMVP");
        cube=buffer(CUBE);
        float[] cylinderData=makeCylinder(18); cylinder=buffer(cylinderData); cylinderVertices=cylinderData.length/3;
    }
    @Override public void onSurfaceChanged(GL10 gl,int w,int h){ width=w;height=h;GLES20.glViewport(0,0,w,h);Matrix.perspectiveM(projection,0,45f,(float)w/h,.05f,40f); }
    @Override public void onDrawFrame(GL10 gl){
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);
        float yr=(float)Math.toRadians(yaw),pr=(float)Math.toRadians(pitch);
        float ex=(float)(Math.sin(yr)*Math.cos(pr)*distance), ey=(float)(Math.sin(pr)*distance)+.7f, ez=(float)(-Math.cos(yr)*Math.cos(pr)*distance);
        Matrix.setLookAtM(view,0,ex,ey,ez,0,.65f,0,0,1,0); Matrix.multiplyMM(vp,0,projection,0,view,0);
        drawGround();
        for(Part p:parts) if(visible(p.category)) drawPart(p,p==selected);
        for(Part p:decor) if(visible(p.category)) drawPart(p,false);
        for(Route r:routes) if(visible(r.category)) drawRoute(r);
        if(pickX>=0){performPick(pickX,pickY);pickX=-1;}
    }

    private boolean visible(int category){ return filter==0 || (filter==1&&category>0) || category==filter; }
    private void drawPart(Part p,boolean highlight){
        Matrix.setIdentityM(model,0); Matrix.translateM(model,0,p.x,p.y,p.z); if(p.rx!=0)Matrix.rotateM(model,0,p.rx,1,0,0); Matrix.scaleM(model,0,p.sx/2,p.sy/2,p.sz/2); Matrix.multiplyMM(mvp,0,vp,0,model,0);
        GLES20.glUseProgram(program); GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0); float[] c=highlight?new float[]{1f,.87f,.25f,1}:p.color; GLES20.glUniform4fv(colorLoc,1,c,0); GLES20.glEnableVertexAttribArray(posLoc); FloatBuffer mesh=p.shape==SHAPE_CYLINDER?cylinder:cube; int count=p.shape==SHAPE_CYLINDER?cylinderVertices:36; mesh.position(0); GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,mesh); GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,count); GLES20.glDisableVertexAttribArray(posLoc);
    }
    private void drawRoute(Route r){
        lineBuffer=buffer(r.xyz); Matrix.multiplyMM(mvp,0,vp,0,identity(),0); GLES20.glUseProgram(program); GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0); GLES20.glUniform4fv(colorLoc,1,r.color,0); GLES20.glLineWidth(r.category==LOW?8:6); GLES20.glEnableVertexAttribArray(posLoc); GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,lineBuffer); GLES20.glDrawArrays(GLES20.GL_LINE_STRIP,0,r.xyz.length/3); GLES20.glDisableVertexAttribArray(posLoc);
    }
    private void drawGround(){
        float[] grid=new float[44*3];int n=0;for(int i=-5;i<=5;i++){grid[n++]=i;grid[n++]=0;grid[n++]=-5;grid[n++]=i;grid[n++]=0;grid[n++]=5;grid[n++]=-5;grid[n++]=0;grid[n++]=i;grid[n++]=5;grid[n++]=0;grid[n++]=i;}
        lineBuffer=buffer(grid);Matrix.multiplyMM(mvp,0,vp,0,identity(),0);GLES20.glUseProgram(program);GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0);GLES20.glUniform4f(colorLoc,.12f,.22f,.26f,1);GLES20.glLineWidth(1);GLES20.glEnableVertexAttribArray(posLoc);GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,lineBuffer);GLES20.glDrawArrays(GLES20.GL_LINES,0,grid.length/3);GLES20.glDisableVertexAttribArray(posLoc);
    }

    private void performPick(float sx,float sy){ Part best=null;float bestD=90f;for(Part p:parts){if(!visible(p.category))continue;float[] v={p.x,p.y,p.z,1},clip=new float[4];Matrix.multiplyMV(clip,0,vp,0,v,0);if(clip[3]<=0)continue;float px=(clip[0]/clip[3]*.5f+.5f)*width,py=(.5f-clip[1]/clip[3]*.5f)*height;float d=(float)Math.hypot(px-sx,py-sy);if(d<bestD){bestD=d;best=p;}}selected=best;if(best!=null)info.accept(best.id+"  •  "+best.name+"\n"+best.note); }
    public void pick(float x,float y){pickX=x;pickY=y;}
    public void setFilter(int value){filter=value;selected=null;}
    public void orbit(float dx,float dy){yaw-=dx*.16f;pitch=Math.max(-5,Math.min(72,pitch-dy*.13f));}
    public void zoom(float factor){distance=Math.max(2.0f,Math.min(10f,distance/factor));}
    public void resetCamera(){yaw=0;pitch=23;distance=4.8f;}

    private void buildModel(){
        float[] body={.38f,.055f,.07f,1},bodyEdge={.56f,.13f,.16f,1},metal={.67f,.71f,.72f,1},aluminum={.78f,.82f,.83f,1},dark={.08f,.11f,.13f,1},rubber={.04f,.055f,.065f,1},glass={.35f,.57f,.68f,.62f},fin={.38f,.46f,.49f,1},high={1f,.56f,.12f,1},low={.20f,.60f,1f,1},coolant={.18f,.45f,.78f,1},wire={.90f,.73f,.20f,1},hvac={.48f,.42f,.80f,1};

        // 26 vehicle, engine and access landmarks.
        box("LANDMARK_BODY_SHELL","UCF10 body shell",LANDMARK,-1.15f,0,.43f,4.35f,1.78f,.24f,body,"Recognizable first-generation LS400 service shell.");
        box("LANDMARK_FRONT_BUMPER","Front bumper and reinforcement",LANDMARK,1.12f,0,.42f,.34f,1.82f,.25f,body,"Front access boundary below the condenser.");
        box("LANDMARK_GRILLE","Upper grille",LANDMARK,1.05f,0,.65f,.08f,.52f,.27f,dark,"Sightline toward the condenser and fan pair.");
        box("LANDMARK_PASSENGER_HEADLIGHT","Passenger-side headlight",LANDMARK,.96f,-.60f,.66f,.20f,.47f,.25f,new float[]{.85f,.91f,.90f,1},"Passenger side is screen-left while facing the car.");
        box("LANDMARK_DRIVER_HEADLIGHT","Driver-side headlight",LANDMARK,.96f,.60f,.66f,.20f,.47f,.25f,new float[]{.85f,.91f,.90f,1},"Driver side is screen-right while facing the car.");
        box("LANDMARK_HOOD","Articulated hood",LANDMARK,-1.18f,0,1.55f,1.35f,1.68f,.08f,body,"Raised service position with underside volume.").rx=-76;
        box("LANDMARK_HOOD_HINGES","Hood hinges and supports",LANDMARK,-.92f,0,.98f,.20f,1.42f,.08f,metal,"Rear hinge/support landmark.");
        box("LANDMARK_FRONT_FENDERS","Front fenders",LANDMARK,.05f,0,.62f,1.92f,1.83f,.10f,bodyEdge,"Defines access from both sides of the bay.");
        box("LANDMARK_WINDSHIELD","Windshield",LANDMARK,-1.58f,0,1.16f,.08f,1.55f,.55f,glass,"Rear engine-bay/cowl landmark.").rx=-22;
        box("LANDMARK_COWL","Cowl and wiper plenum",LANDMARK,-1.04f,0,.94f,.32f,1.70f,.12f,dark,"Separates engine bay and cabin air intake.");
        box("LANDMARK_FIREWALL","Firewall",LANDMARK,-1.08f,0,.67f,.08f,1.62f,.72f,metal,"Engine-bay/cabin boundary and A/C pass-through.");
        box("LANDMARK_DASHBOARD","Dashboard volume",LANDMARK,-1.55f,0,.82f,.70f,1.58f,.42f,dark,"Cutaway orientation volume.");
        box("LANDMARK_PASSENGER_FOOTWELL","Passenger footwell / glovebox",LANDMARK,-1.56f,-.38f,.40f,.55f,.60f,.50f,new float[]{.14f,.18f,.22f,.55f},"Passenger cabin HVAC access volume.");
        box("LANDMARK_RADIATOR_SUPPORT","Radiator support",LANDMARK,.67f,0,.87f,.10f,1.62f,.10f,metal,"Mounting datum for condenser, receiver and headlights.");
        box("LANDMARK_FRONT_FRAME_RAILS","Front frame rails",LANDMARK,-.10f,0,.25f,1.55f,1.20f,.12f,metal,"Structural underbody reference.");
        box("LANDMARK_SPLASH_SHIELDS","Splash shields and undercovers",LANDMARK,.05f,0,.15f,1.65f,1.55f,.06f,dark,"May block lower compressor access.");
        box("LANDMARK_RADIATOR","Engine radiator",LANDMARK,.59f,0,.64f,.10f,1.34f,.62f,fin,"Behind the A/C condenser.");
        cylinder("LANDMARK_COOLING_FANS","Electric cooling fan pair",LANDMARK,.69f,0,.62f,.11f,.60f,.60f,dark,"Twin-fan plane ahead of the heat-exchanger stack.").rx=90;
        box("ENGINE_1UZ_FE","1UZ-FE V8 engine",LANDMARK,-.23f,0,.64f,1.20f,.90f,.60f,aluminum,"Central engine and intake landmark.");
        box("ENGINE_ACCESSORY_DRIVE","Accessory belt and pulleys",LANDMARK,.35f,0,.47f,.20f,.75f,.35f,dark,"Front engine accessory drive.");
        cylinder("ENGINE_ALTERNATOR","Alternator",LANDMARK,.23f,-.25f,.38f,.20f,.22f,.22f,metal,"Passenger/front accessory landmark.").rx=90;
        cylinder("ENGINE_POWER_STEERING_PUMP","Power-steering pump",LANDMARK,.23f,.25f,.56f,.18f,.20f,.20f,metal,"Driver/front accessory landmark.").rx=90;
        box("LANDMARK_BATTERY","Battery",LANDMARK,.02f,.67f,.66f,.42f,.29f,.30f,dark,"Driver-side engine-bay landmark.");
        box("LANDMARK_AIRBOX","Air cleaner box",LANDMARK,.05f,-.65f,.65f,.47f,.36f,.29f,dark,"Passenger-side front landmark.");
        box("LANDMARK_INTAKE_TUBE","Intake duct and airflow meter",LANDMARK,-.03f,-.38f,.74f,.45f,.17f,.17f,rubber,"Strong landmark above the passenger-side accessory area.");
        cylinder("LANDMARK_BRAKE_BOOSTER","Brake booster and master cylinder",LANDMARK,-1.00f,.56f,.76f,.18f,.31f,.31f,dark,"Driver-side firewall landmark.").rx=90;

        // 23 selectable A/C and HVAC components, for 49 total components.
        cylinder("AC_COMPRESSOR","A/C compressor",AC,.30f,.40f,.47f,.30f,.30f,.30f,metal,"Low front driver side; cast body and ports. Never flush through it.").rx=90;
        cylinder("AC_COMPRESSOR_CLUTCH","Compressor clutch and pulley",AC,.47f,.40f,.47f,.08f,.32f,.32f,dark,"Front pulley/clutch face.").rx=90;
        box("AC_COMPRESSOR_BRACKET","Compressor mounting bracket",AC,.30f,.40f,.38f,.30f,.34f,.10f,metal,"Mounts compressor to lower front engine.");
        cylinder("AC_DISCHARGE_PORT","Compressor discharge port",HIGH,.30f,.40f,.59f,.07f,.06f,.06f,high,"High-pressure compressor outlet.");
        cylinder("AC_SUCTION_PORT","Compressor suction port",LOW,.27f,.42f,.60f,.08f,.08f,.08f,low,"Low-pressure compressor inlet.");
        box("AC_CONDENSER","A/C condenser",HIGH,.75f,0,.64f,.07f,1.30f,.58f,fin,"Thin high-side heat exchanger ahead of the radiator.");
        cylinder("AC_CONDENSER_INLET","Condenser inlet fitting",HIGH,.64f,.61f,.70f,.08f,.06f,.06f,high,"Receives compressor discharge vapor.");
        cylinder("AC_CONDENSER_OUTLET","Condenser outlet fitting",HIGH,.64f,-.62f,.48f,.08f,.06f,.06f,high,"Sends high-pressure liquid toward receiver-drier.");
        cylinder("AC_RECEIVER_DRIER","Receiver-drier",HIGH,.60f,-.72f,.59f,.34f,.12f,.12f,aluminum,"Passenger-side support canister. Replace as required; never flush through it.");
        box("AC_RECEIVER_DRIER_BRACKET","Receiver-drier clamp and bracket",AC,.60f,-.78f,.59f,.30f,.05f,.10f,metal,"Clamp and radiator-support mounting point.");
        cylinder("AC_PRESSURE_SWITCH","A/C pressure switch",HIGH,.10f,-.78f,.83f,.08f,.07f,.07f,wire,"Electrical pressure-control branch on high-side liquid route.");
        cylinder("AC_SIGHT_GLASS","Receiver sight glass",HIGH,.60f,-.72f,.76f,.04f,.05f,.05f,new float[]{.40f,.85f,.90f,.9f},"Original-system inspection feature near receiver top.");
        cylinder("AC_HIGH_SERVICE_PORT","High-side service port",HIGH,.03f,-.78f,.865f,.13f,.09f,.09f,high,"Passenger side, high-pressure liquid route; exact target-car landing remains approximate.");
        cylinder("AC_LOW_SERVICE_PORT","Low-side service port",LOW,-.32f,-.20f,.82f,.15f,.11f,.11f,low,"Passenger-side/firewall suction route; verify physical adapter.");
        box("AC_EXPANSION_VALVE","Expansion valve area",HIGH,-1.00f,-.47f,.72f,.16f,.12f,.16f,high,"Passenger firewall/HVAC case. Never flush through it.");
        box("AC_EVAPORATOR","Evaporator core",LOW,-1.20f,-.41f,.66f,.32f,.52f,.25f,new float[]{.45f,.72f,.78f,1},"Inside passenger-side HVAC case.");
        cylinder("AC_EPR","Evaporator pressure regulator",LOW,-1.00f,-.42f,.67f,.20f,.15f,.15f,low,"Low-side regulator at evaporator outlet. Never flush through it.").rx=90;
        box("HVAC_CASE","HVAC case",AC,-1.27f,-.28f,.65f,.48f,.78f,.55f,new float[]{.25f,.28f,.33f,.72f},"Cabin case containing evaporator, blower and heater core.");
        cylinder("HVAC_BLOWER_HOUSING","Blower housing",AC,-1.33f,-.64f,.63f,.35f,.35f,.35f,dark,"Passenger-side blower scroll housing.").rx=90;
        cylinder("HVAC_BLOWER_MOTOR","Blower motor and fan",AC,-1.34f,-.65f,.62f,.24f,.22f,.22f,metal,"Electrical blower motor in passenger footwell.").rx=90;
        box("HVAC_HEATER_CORE","Heater core",AC,-1.28f,.02f,.62f,.30f,.30f,.20f,new float[]{.73f,.45f,.25f,1},"Coolant heat exchanger inside HVAC case.");
        box("HVAC_AIR_MIX_DOOR","Air-mix door",AC,-1.30f,-.12f,.65f,.28f,.24f,.03f,hvac,"Conceptual door showing case airflow relationship.");
        cylinder("HVAC_DRAIN_TUBE","Evaporator drain tube",AC,-1.10f,-.43f,.33f,.32f,.05f,.05f,rubber,"Condensate drain; not a refrigerant line.");

        // Service-recognition surface detail. These meshes belong to the 49 named components above.
        detailBox(LANDMARK,-.25f,-.29f,.77f,.78f,.27f,.16f,new float[]{.38f,.42f,.44f,1});
        detailBox(LANDMARK,-.25f,.29f,.77f,.78f,.27f,.16f,new float[]{.38f,.42f,.44f,1});
        detailBox(LANDMARK,-.30f,0,.92f,.55f,.32f,.22f,aluminum);
        for(int i=-3;i<=3;i++) detailBox(LANDMARK,1.09f,i*.065f,.65f,.05f,.035f,.22f,metal);
        for(int i=-6;i<=6;i++) detailBox(HIGH,.755f,i*.09f,.64f,.035f,.018f,.54f,new float[]{.62f,.68f,.69f,1});
        detailCylinder(LANDMARK,.66f,-.34f,.62f,.08f,.46f,.46f,dark).rx=90;
        detailCylinder(LANDMARK,.66f,.34f,.62f,.08f,.46f,.46f,dark).rx=90;
        detailCylinder(AC,.48f,.40f,.47f,.07f,.28f,.28f,dark).rx=90;
        for(int i=0;i<6;i++) detailBox(AC,.60f,-.72f,.47f+i*.045f,.025f,.16f,.012f,metal);
        detailBox(LANDMARK,-.02f,-.48f,.72f,.42f,.13f,.13f,rubber);
        detailBox(LANDMARK,.02f,.67f,.72f,.05f,.34f,.03f,metal);
        for(float side:new float[]{-.70f,.70f}) detailBox(LANDMARK,-.78f,side,1.25f,.85f,.025f,.025f,metal).rx=-58;

        // Seven refrigerant routes plus nine surrounding service routes = 16.
        route("AC_DISCHARGE_LINE",HIGH,high,new float[][]{{.30f,.40f,.58f},{.50f,.38f,.68f},{.72f,.55f,.70f},{.64f,.61f,.70f}});
        route("AC_LIQUID_LINE_CONDENSER_DRIER",HIGH,high,new float[][]{{.64f,-.62f,.48f},{.64f,-.69f,.52f},{.60f,-.72f,.59f}});
        route("AC_LIQUID_LINE_DRIER_FIREWALL",HIGH,high,new float[][]{{.60f,-.72f,.59f},{.18f,-.78f,.78f},{-.45f,-.70f,.84f},{-1.00f,-.47f,.72f}});
        route("AC_EVAPORATOR_FEED_INTERNAL",LOW,low,new float[][]{{-1.00f,-.47f,.72f},{-1.10f,-.45f,.70f},{-1.19f,-.42f,.70f}});
        route("AC_EVAPORATOR_RETURN_INTERNAL",LOW,low,new float[][]{{-1.19f,-.42f,.66f},{-1.09f,-.42f,.67f},{-1.00f,-.42f,.67f}});
        route("AC_SUCTION_LINE",LOW,low,new float[][]{{-1.00f,-.42f,.67f},{-.62f,-.34f,.78f},{-.08f,-.15f,.76f},{.27f,.42f,.59f}});
        route("AC_EQUALIZER_TUBE",LOW,low,new float[][]{{-1.18f,-.35f,.75f},{-1.10f,-.35f,.77f},{-1.02f,-.40f,.72f}});
        route("HVAC_DRAIN_ROUTE",AC,rubber,new float[][]{{-1.16f,-.42f,.46f},{-1.12f,-.43f,.31f},{-1.06f,-.43f,.20f}});
        route("COOLING_UPPER_HOSE",LANDMARK,coolant,new float[][]{{.48f,-.42f,.78f},{.20f,-.26f,.82f},{-.04f,-.12f,.78f}});
        route("COOLING_LOWER_HOSE",LANDMARK,coolant,new float[][]{{.48f,.38f,.42f},{.22f,.26f,.35f},{-.06f,.10f,.38f}});
        route("HVAC_HEATER_HOSE_FEED",LANDMARK,coolant,new float[][]{{-.98f,.16f,.79f},{-.62f,.12f,.76f},{-.30f,.08f,.72f}});
        route("HVAC_HEATER_HOSE_RETURN",LANDMARK,coolant,new float[][]{{-.98f,.26f,.75f},{-.62f,.22f,.70f},{-.30f,.18f,.66f}});
        route("ELECTRICAL_AC_HARNESS",LANDMARK,wire,new float[][]{{.10f,-.78f,.84f},{-.10f,-.56f,.82f},{-.28f,-.28f,.76f},{.28f,.38f,.62f}});
        route("BRAKE_VACUUM_HOSE",LANDMARK,rubber,new float[][]{{-.98f,.50f,.80f},{-.65f,.34f,.80f},{-.30f,.20f,.75f}});
        route("POWER_STEERING_HIGH_PRESSURE",LANDMARK,new float[]{.85f,.32f,.37f,1},new float[][]{{.23f,.25f,.56f},{.05f,.34f,.48f},{-.20f,.40f,.42f}});
        route("POWER_STEERING_RETURN",LANDMARK,new float[]{.85f,.32f,.37f,1},new float[][]{{.20f,.22f,.52f},{.02f,.30f,.58f},{-.22f,.38f,.55f}});
    }

    private Part box(String id,String name,int cat,float f,float l,float u,float sf,float sl,float su,float[] color,String note){Part p=new Part(id,name,cat,-l,u,-f,sl,su,sf,color,note);parts.add(p);return p;}
    private Part cylinder(String id,String name,int cat,float f,float l,float u,float sf,float sl,float su,float[] color,String note){Part p=box(id,name,cat,f,l,u,sf,sl,su,color,note);p.shape=SHAPE_CYLINDER;return p;}
    private Part detailBox(int cat,float f,float l,float u,float sf,float sl,float su,float[] color){Part p=new Part("DETAIL","Component detail",cat,-l,u,-f,sl,su,sf,color,"");decor.add(p);return p;}
    private Part detailCylinder(int cat,float f,float l,float u,float sf,float sl,float su,float[] color){Part p=detailBox(cat,f,l,u,sf,sl,su,color);p.shape=SHAPE_CYLINDER;return p;}
    private void route(String id,int cat,float[] color,float[][] pts){float[] xyz=new float[pts.length*3];for(int i=0;i<pts.length;i++){xyz[i*3]=-pts[i][1];xyz[i*3+1]=pts[i][2];xyz[i*3+2]=-pts[i][0];}routes.add(new Route(id,cat,color,xyz));}
    private static FloatBuffer buffer(float[] a){FloatBuffer b=ByteBuffer.allocateDirect(a.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();b.put(a).position(0);return b;}
    private static float[] makeCylinder(int segments){float[] out=new float[segments*12*3];int n=0;for(int i=0;i<segments;i++){double a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;float ax=(float)Math.cos(a),az=(float)Math.sin(a),bx=(float)Math.cos(b),bz=(float)Math.sin(b);float[] v={ax,-1,az,bx,-1,bz,bx,1,bz, ax,-1,az,bx,1,bz,ax,1,az, 0,1,0,bx,1,bz,ax,1,az, 0,-1,0,ax,-1,az,bx,-1,bz};for(float value:v)out[n++]=value;}return out;}
    private static float[] identity(){float[] i=new float[16];Matrix.setIdentityM(i,0);return i;}
    private static int shader(int type,String src){int s=GLES20.glCreateShader(type);GLES20.glShaderSource(s,src);GLES20.glCompileShader(s);return s;}
    private static int link(String vs,String fs){int p=GLES20.glCreateProgram();GLES20.glAttachShader(p,shader(GLES20.GL_VERTEX_SHADER,vs));GLES20.glAttachShader(p,shader(GLES20.GL_FRAGMENT_SHADER,fs));GLES20.glLinkProgram(p);return p;}
    private static final class Part{final String id,name,note;final int category;final float x,y,z,sx,sy,sz;final float[] color;float rx;int shape=SHAPE_BOX;Part(String i,String n,int c,float x,float y,float z,float sx,float sy,float sz,float[] col,String note){id=i;name=n;category=c;this.x=x;this.y=y;this.z=z;this.sx=sx;this.sy=sy;this.sz=sz;color=col;this.note=note;}}
    private static final class Route{final String id;final int category;final float[] color,xyz;Route(String i,int c,float[] col,float[] x){id=i;category=c;color=col;xyz=x;}}
}
