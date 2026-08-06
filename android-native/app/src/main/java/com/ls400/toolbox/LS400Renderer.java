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
    private static final int LANDMARK=0, AC=1, HIGH=2, LOW=3;
    private final Consumer<String> info;
    private final List<Part> parts=new ArrayList<>();
    private final List<Route> routes=new ArrayList<>();
    private final float[] projection=new float[16],view=new float[16],vp=new float[16],model=new float[16],mvp=new float[16];
    private FloatBuffer cube, lineBuffer;
    private int program,posLoc,colorLoc,mvpLoc,width,height,filter=0;
    private float yaw=0f,pitch=18f,distance=6.2f;
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
    }
    @Override public void onSurfaceChanged(GL10 gl,int w,int h){ width=w;height=h;GLES20.glViewport(0,0,w,h);Matrix.perspectiveM(projection,0,45f,(float)w/h,.05f,40f); }
    @Override public void onDrawFrame(GL10 gl){
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);
        float yr=(float)Math.toRadians(yaw),pr=(float)Math.toRadians(pitch);
        float ex=(float)(Math.sin(yr)*Math.cos(pr)*distance), ey=(float)(Math.sin(pr)*distance)+.7f, ez=(float)(-Math.cos(yr)*Math.cos(pr)*distance);
        Matrix.setLookAtM(view,0,ex,ey,ez,0,.65f,0,0,1,0); Matrix.multiplyMM(vp,0,projection,0,view,0);
        drawGround();
        for(Part p:parts) if(visible(p.category)) drawPart(p,p==selected);
        for(Route r:routes) if(visible(r.category)) drawRoute(r);
        if(pickX>=0){performPick(pickX,pickY);pickX=-1;}
    }

    private boolean visible(int category){ return filter==0 || (filter==1&&category>0) || category==filter; }
    private void drawPart(Part p,boolean highlight){
        Matrix.setIdentityM(model,0); Matrix.translateM(model,0,p.x,p.y,p.z); if(p.rx!=0)Matrix.rotateM(model,0,p.rx,1,0,0); Matrix.scaleM(model,0,p.sx/2,p.sy/2,p.sz/2); Matrix.multiplyMM(mvp,0,vp,0,model,0);
        GLES20.glUseProgram(program); GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0); float[] c=highlight?new float[]{1f,.87f,.25f,1}:p.color; GLES20.glUniform4fv(colorLoc,1,c,0); GLES20.glEnableVertexAttribArray(posLoc); cube.position(0); GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,cube); GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,36); GLES20.glDisableVertexAttribArray(posLoc);
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
    public void resetCamera(){yaw=0;pitch=18;distance=6.2f;}

    private void buildModel(){
        float[] body={.38f,.055f,.07f,1},metal={.67f,.71f,.72f,1},dark={.08f,.11f,.13f,1},glass={.35f,.57f,.68f,.65f},high={1f,.56f,.12f,1},low={.20f,.60f,1f,1};
        box("BODY","UCF10 body shell",LANDMARK,0,0,.45f,4.9f,1.78f,.28f,body,"First-generation LS400 orientation shell.");
        box("BUMPER","Front bumper",LANDMARK,1.12f,0,.42f,.32f,1.82f,.25f,body,"Front access landmark.");
        box("HOOD","Raised hood",LANDMARK,-.15f,0,1.65f,1.75f,1.68f,.08f,body,"Articulated hood shown open.").rx=-68;
        box("ENGINE_1UZ_FE","1UZ-FE V8",LANDMARK,-.20f,0,.70f,1.18f,.86f,.62f,metal,"Central engine landmark.");
        box("RADIATOR","Radiator",LANDMARK,.63f,0,.64f,.10f,1.34f,.62f,metal,"Behind the condenser.");
        box("AC_CONDENSER","A/C condenser",AC,.75f,0,.64f,.07f,1.30f,.58f,new float[]{.45f,.52f,.55f,1},"High-side heat exchanger ahead of the radiator.");
        box("PASSENGER_HEADLIGHT","Passenger headlight",LANDMARK,.96f,-.60f,.66f,.20f,.47f,.25f,new float[]{.85f,.91f,.90f,1},"Passenger side is screen-left from the front.");
        box("DRIVER_HEADLIGHT","Driver headlight",LANDMARK,.96f,.60f,.66f,.20f,.47f,.25f,new float[]{.85f,.91f,.90f,1},"Driver side is screen-right from the front.");
        box("BATTERY","Battery",LANDMARK,.02f,.67f,.66f,.42f,.29f,.30f,dark,"Driver-side engine-bay landmark.");
        box("AIRBOX","Air cleaner box",LANDMARK,.05f,-.65f,.65f,.47f,.36f,.29f,dark,"Passenger-side front landmark.");
        box("AC_COMPRESSOR","A/C compressor",AC,.30f,.40f,.47f,.34f,.30f,.28f,metal,"Low front driver side. Never flush through the compressor.");
        box("AC_RECEIVER_DRIER","Receiver-drier",HIGH,.60f,-.72f,.59f,.10f,.12f,.34f,metal,"Passenger-side front support. Replace during appropriate retrofit service; never flush through it.");
        box("AC_HIGH_SERVICE_PORT","High-side service port",HIGH,.03f,-.78f,.865f,.09f,.09f,.13f,high,"Passenger side, high-pressure liquid route. Exact target-vehicle landing remains approximate.");
        box("AC_LOW_SERVICE_PORT","Low-side service port",LOW,-.32f,-.20f,.82f,.11f,.11f,.15f,low,"Passenger-side/firewall suction route. Verify the physical fitting and conversion adapter.");
        box("AC_EXPANSION_VALVE","Expansion valve area",HIGH,-1.00f,-.47f,.72f,.16f,.12f,.16f,high,"Passenger firewall/HVAC case. Never flush through the valve.");
        box("AC_EVAPORATOR","Evaporator core",LOW,-1.20f,-.41f,.66f,.32f,.52f,.25f,new float[]{.45f,.72f,.78f,1},"Inside passenger-side HVAC case.");
        route("DISCHARGE",HIGH,high,new float[][]{{.30f,.40f,.58f},{.50f,.38f,.68f},{.72f,.55f,.70f},{.64f,.61f,.70f}});
        route("LIQUID_FRONT",HIGH,high,new float[][]{{.64f,-.62f,.48f},{.64f,-.69f,.52f},{.60f,-.72f,.59f}});
        route("LIQUID_FIREWALL",HIGH,high,new float[][]{{.60f,-.72f,.59f},{.18f,-.78f,.78f},{-.45f,-.70f,.84f},{-1.00f,-.47f,.72f}});
        route("SUCTION",LOW,low,new float[][]{{-1.00f,-.42f,.67f},{-.62f,-.34f,.78f},{-.08f,-.15f,.76f},{.27f,.42f,.59f}});
    }

    private Part box(String id,String name,int cat,float f,float l,float u,float sf,float sl,float su,float[] color,String note){Part p=new Part(id,name,cat,-l,u,-f,sl,su,sf,color,note);parts.add(p);return p;}
    private void route(String id,int cat,float[] color,float[][] pts){float[] xyz=new float[pts.length*3];for(int i=0;i<pts.length;i++){xyz[i*3]=-pts[i][1];xyz[i*3+1]=pts[i][2];xyz[i*3+2]=-pts[i][0];}routes.add(new Route(id,cat,color,xyz));}
    private static FloatBuffer buffer(float[] a){FloatBuffer b=ByteBuffer.allocateDirect(a.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();b.put(a).position(0);return b;}
    private static float[] identity(){float[] i=new float[16];Matrix.setIdentityM(i,0);return i;}
    private static int shader(int type,String src){int s=GLES20.glCreateShader(type);GLES20.glShaderSource(s,src);GLES20.glCompileShader(s);return s;}
    private static int link(String vs,String fs){int p=GLES20.glCreateProgram();GLES20.glAttachShader(p,shader(GLES20.GL_VERTEX_SHADER,vs));GLES20.glAttachShader(p,shader(GLES20.GL_FRAGMENT_SHADER,fs));GLES20.glLinkProgram(p);return p;}
    private static final class Part{final String id,name,note;final int category;final float x,y,z,sx,sy,sz;final float[] color;float rx;Part(String i,String n,int c,float x,float y,float z,float sx,float sy,float sz,float[] col,String note){id=i;name=n;category=c;this.x=x;this.y=y;this.z=z;this.sx=sx;this.sy=sy;this.sz=sz;color=col;this.note=note;}}
    private static final class Route{final String id;final int category;final float[] color,xyz;Route(String i,int c,float[] col,float[] x){id=i;category=c;color=col;xyz=x;}}
}
