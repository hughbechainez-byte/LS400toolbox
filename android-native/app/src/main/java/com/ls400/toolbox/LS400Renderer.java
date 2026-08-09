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
    // RM144U B0-186 engine-compartment hardpoints, in vehicle metres.
    private static final float COWL_J_J_SPAN_M=ModelManifest.COWL_J_J_SPAN_M;
    private static final float INNER_COWL_C_C_SPAN_M=ModelManifest.INNER_COWL_C_C_SPAN_M;
    private static final float RADIATOR_SUPPORT_A_A_SPAN_M=ModelManifest.RADIATOR_SUPPORT_A_A_SPAN_M;
    private static final float SPRING_SUPPORT_B_B_SPAN_M=ModelManifest.SPRING_SUPPORT_B_B_SPAN_M;
    private static final float B_B_INNER_FRONT_HOLE_OFFSET_M=SPRING_SUPPORT_B_B_SPAN_M/2f;
    // These shell coordinates are generated from the shared physical envelope.
    // The B-b holes above remain the factory 1.050 m pair; the visible domes
    // and apron rails stay inside the 1.820 m vehicle width contract.
    private static final float STRUT_TOWER_APRON_CENTER_OFFSET_M=ModelManifest.STRUT_TOWER_APRON_CENTER_OFFSET_M;
    private static final float OUTER_TOP_APRON_HALF_WIDTH_M=ModelManifest.OUTER_TOP_APRON_HALF_WIDTH_M;
    private static final float INNER_APRON_RAIL_CENTER_OFFSET_M=ModelManifest.INNER_APRON_RAIL_CENTER_OFFSET_M;
    private static final float OUTER_APRON_RAIL_CENTER_OFFSET_M=ModelManifest.OUTER_APRON_RAIL_CENTER_OFFSET_M;
    private static final float PASSENGER_STRUT_TOWER_FORWARD_M=ModelManifest.PASSENGER_STRUT_TOWER_FORWARD_M, PASSENGER_STRUT_TOWER_LATERAL_M=ModelManifest.PASSENGER_STRUT_TOWER_LATERAL_M;
    private static final float DRIVER_STRUT_TOWER_FORWARD_M=ModelManifest.DRIVER_STRUT_TOWER_FORWARD_M, DRIVER_STRUT_TOWER_LATERAL_M=ModelManifest.DRIVER_STRUT_TOWER_LATERAL_M;
    private static final float ENGINE_FORWARD_M=ModelManifest.ENGINE_FORWARD_M, ENGINE_UP_M=ModelManifest.ENGINE_UP_M;
    private static final float THROTTLE_FORWARD_M=ModelManifest.THROTTLE_FORWARD_M, THROTTLE_LATERAL_M=ModelManifest.THROTTLE_LATERAL_M, THROTTLE_UP_M=ModelManifest.THROTTLE_UP_M;
    private static final float AIRBOX_FORWARD_M=ModelManifest.AIRBOX_FORWARD_M, AIRBOX_LATERAL_M=ModelManifest.AIRBOX_LATERAL_M, AIRBOX_UP_M=ModelManifest.AIRBOX_UP_M;
    private static final float MAF_FORWARD_M=ModelManifest.MAF_FORWARD_M, MAF_LATERAL_M=ModelManifest.MAF_LATERAL_M, MAF_UP_M=ModelManifest.MAF_UP_M;
    private static final float DRIVER_BATTERY_FORWARD_M=ModelManifest.DRIVER_BATTERY_FORWARD_M, DRIVER_BATTERY_LATERAL_M=ModelManifest.DRIVER_BATTERY_LATERAL_M, DRIVER_BATTERY_UP_M=ModelManifest.DRIVER_BATTERY_UP_M;
    private static final float DRIVER_FUSE_FORWARD_M=ModelManifest.DRIVER_FUSE_FORWARD_M, DRIVER_FUSE_LATERAL_M=ModelManifest.DRIVER_FUSE_LATERAL_M, DRIVER_FUSE_UP_M=ModelManifest.DRIVER_FUSE_UP_M;
    private static final float DRIVER_COOLANT_RESERVE_FORWARD_M=ModelManifest.DRIVER_COOLANT_RESERVE_FORWARD_M, DRIVER_COOLANT_RESERVE_LATERAL_M=ModelManifest.DRIVER_COOLANT_RESERVE_LATERAL_M, DRIVER_COOLANT_RESERVE_UP_M=ModelManifest.DRIVER_COOLANT_RESERVE_UP_M;
    private static final float BRAKE_BOOSTER_FORWARD_M=ModelManifest.BRAKE_BOOSTER_FORWARD_M, BRAKE_BOOSTER_LATERAL_M=ModelManifest.BRAKE_BOOSTER_LATERAL_M, BRAKE_BOOSTER_UP_M=ModelManifest.BRAKE_BOOSTER_UP_M;
    private static final float RADIATOR_SUPPORT_FORWARD_M=ModelManifest.RADIATOR_SUPPORT_FORWARD_M, CONDENSER_FORWARD_M=ModelManifest.CONDENSER_FORWARD_M, FAN_PLANE_FORWARD_M=ModelManifest.FAN_PLANE_FORWARD_M, RADIATOR_FORWARD_M=ModelManifest.RADIATOR_FORWARD_M, FRONT_BUMPER_FORWARD_M=ModelManifest.FRONT_BUMPER_FORWARD_M;
    private static final float RECEIVER_DRIER_FORWARD_M=ModelManifest.RECEIVER_DRIER_FORWARD_M, RECEIVER_DRIER_LATERAL_M=ModelManifest.RECEIVER_DRIER_LATERAL_M, RECEIVER_DRIER_UP_M=ModelManifest.RECEIVER_DRIER_UP_M;
    private static final float PHOTO_CAMERA_FOV_DEG=ModelManifest.PHOTO_CAMERA_FOV_DEG;
    private static final int LANDMARK=0, AC=1, HIGH=2, LOW=3, SHAPE_BOX=0, SHAPE_CYLINDER=1, SHAPE_TORUS=2;
    private final Consumer<String> info;
    private final List<Part> parts=new ArrayList<>();
    private final List<Part> decor=new ArrayList<>();
    private final List<Route> routes=new ArrayList<>();
    private final float[] projection=new float[16],view=new float[16],vp=new float[16],model=new float[16],mvp=new float[16];
    private FloatBuffer cube, cylinder, torus, lineBuffer;
    private int cylinderVertices,torusVertices;
    private int program,posLoc,colorLoc,mvpLoc,width,height,filter=0;
    private boolean windowsDetailParity=false;
    private boolean validationMode=false;
    private float yaw=0f,pitch=23f,distance=4.8f,targetX=0,targetY=.65f,targetZ=0;
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
        String vs="uniform mat4 uMVP; attribute vec3 aPos; varying float vShade; void main(){vec3 n=normalize(aPos+vec3(.001));vShade=.68+.32*max(0.,dot(n,normalize(vec3(-.45,.8,.55))));gl_Position=uMVP*vec4(aPos,1.0);}";
        String fs="precision mediump float; uniform vec4 uColor; varying float vShade; void main(){gl_FragColor=vec4(uColor.rgb*vShade,uColor.a);}";
        program=link(vs,fs); posLoc=GLES20.glGetAttribLocation(program,"aPos"); colorLoc=GLES20.glGetUniformLocation(program,"uColor"); mvpLoc=GLES20.glGetUniformLocation(program,"uMVP");
        cube=buffer(CUBE);
        float[] cylinderData=makeCylinder(18); cylinder=buffer(cylinderData); cylinderVertices=cylinderData.length/3;
        float[] torusData=makeTorus(28,10,.72f,.28f); torus=buffer(torusData); torusVertices=torusData.length/3;
    }
    @Override public void onSurfaceChanged(GL10 gl,int w,int h){ width=w;height=h;GLES20.glViewport(0,0,w,h);Matrix.perspectiveM(projection,0,PHOTO_CAMERA_FOV_DEG,(float)w/h,.05f,40f); }
    @Override public void onDrawFrame(GL10 gl){
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);
        float yr=(float)Math.toRadians(yaw),pr=(float)Math.toRadians(pitch);
        float ex=targetX+(float)(Math.sin(yr)*Math.cos(pr)*distance), ey=targetY+(float)(Math.sin(pr)*distance), ez=targetZ+(float)(-Math.cos(yr)*Math.cos(pr)*distance);
        Matrix.setLookAtM(view,0,ex,ey,ez,targetX,targetY,targetZ,0,1,0); Matrix.multiplyMM(vp,0,projection,0,view,0);
        drawGround();
        for(Part p:parts) if(visible(p.category)) drawPart(p,p==selected);
        if(windowsDetailParity) for(Part p:decor) if(visible(p.category)) drawPart(p,false);
        for(Route r:routes) if(visible(r.category)) drawRoute(r);
        if(validationMode) drawValidation();
        if(pickX>=0){performPick(pickX,pickY);pickX=-1;}
    }

    private boolean visible(int category){ return filter==0 || (filter==1&&category>0) || category==filter; }
    private void drawPart(Part p,boolean highlight){
        Matrix.setIdentityM(model,0); Matrix.translateM(model,0,p.x,p.y,p.z); if(p.rx!=0)Matrix.rotateM(model,0,p.rx,1,0,0); if(p.ry!=0)Matrix.rotateM(model,0,p.ry,0,1,0); if(p.rz!=0)Matrix.rotateM(model,0,p.rz,0,0,1); Matrix.scaleM(model,0,p.sx/2,p.sy/2,p.sz/2); Matrix.multiplyMM(mvp,0,vp,0,model,0);
        GLES20.glUseProgram(program); GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0); float[] c=highlight?new float[]{1f,.87f,.25f,1}:p.color; GLES20.glUniform4fv(colorLoc,1,c,0); GLES20.glEnableVertexAttribArray(posLoc); FloatBuffer mesh=p.shape==SHAPE_CYLINDER?cylinder:p.shape==SHAPE_TORUS?torus:cube; int count=p.shape==SHAPE_CYLINDER?cylinderVertices:p.shape==SHAPE_TORUS?torusVertices:36; mesh.position(0); GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,mesh); GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,count); GLES20.glDisableVertexAttribArray(posLoc);
    }
    private void drawRoute(Route r){
        float radius=r.radius>0?r.radius:r.id.startsWith("BODY_APRON_")?.032f:r.category==LOW?.026f:r.category==HIGH?.019f:.015f;
        for(int i=0;i<r.xyz.length/3-1;i++) drawTubeSegment(r.xyz[i*3],r.xyz[i*3+1],r.xyz[i*3+2],r.xyz[i*3+3],r.xyz[i*3+4],r.xyz[i*3+5],radius,r.color);
    }
    private void drawTubeSegment(float ax,float ay,float az,float bx,float by,float bz,float radius,float[] color){
        float dx=bx-ax,dy=by-ay,dz=bz-az,len=(float)Math.sqrt(dx*dx+dy*dy+dz*dz);if(len<.0001f)return;
        Matrix.setIdentityM(model,0);Matrix.translateM(model,0,(ax+bx)/2,(ay+by)/2,(az+bz)/2);
        float ny=dy/len,angle=(float)Math.toDegrees(Math.acos(Math.max(-1,Math.min(1,ny))));float rx=dz/len,rz=-dx/len;
        if(Math.abs(angle)>.01f)Matrix.rotateM(model,0,angle,rx,0,rz);
        Matrix.scaleM(model,0,radius,len/2,radius);Matrix.multiplyMM(mvp,0,vp,0,model,0);
        GLES20.glUseProgram(program);GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0);GLES20.glUniform4fv(colorLoc,1,color,0);GLES20.glEnableVertexAttribArray(posLoc);cylinder.position(0);GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,cylinder);GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,cylinderVertices);GLES20.glDisableVertexAttribArray(posLoc);
    }
    private void drawGround(){
        float[] grid=new float[44*3];int n=0;for(int i=-5;i<=5;i++){grid[n++]=i;grid[n++]=0;grid[n++]=-5;grid[n++]=i;grid[n++]=0;grid[n++]=5;grid[n++]=-5;grid[n++]=0;grid[n++]=i;grid[n++]=5;grid[n++]=0;grid[n++]=i;}
        lineBuffer=buffer(grid);Matrix.multiplyMM(mvp,0,vp,0,identity(),0);GLES20.glUseProgram(program);GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0);GLES20.glUniform4f(colorLoc,.12f,.22f,.26f,1);GLES20.glLineWidth(1);GLES20.glEnableVertexAttribArray(posLoc);GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,lineBuffer);GLES20.glDrawArrays(GLES20.GL_LINES,0,grid.length/3);GLES20.glDisableVertexAttribArray(posLoc);
    }

    private void drawValidation(){
        float[] datum={
            -COWL_J_J_SPAN_M/2f,.94f,1.04f, COWL_J_J_SPAN_M/2f,.94f,1.04f,
            -INNER_COWL_C_C_SPAN_M/2f,.67f,1.08f, INNER_COWL_C_C_SPAN_M/2f,.67f,1.08f,
            -RADIATOR_SUPPORT_A_A_SPAN_M/2f,.87f,-.67f, RADIATOR_SUPPORT_A_A_SPAN_M/2f,.87f,-.67f,
            -B_B_INNER_FRONT_HOLE_OFFSET_M,.70f,.45f, B_B_INNER_FRONT_HOLE_OFFSET_M,.70f,.45f,
            -STRUT_TOWER_APRON_CENTER_OFFSET_M,.70f,.45f, STRUT_TOWER_APRON_CENTER_OFFSET_M,.70f,.45f,
            -INNER_APRON_RAIL_CENTER_OFFSET_M,.76f,.45f, INNER_APRON_RAIL_CENTER_OFFSET_M,.76f,.45f,
            -OUTER_APRON_RAIL_CENTER_OFFSET_M,.73f,.45f, OUTER_APRON_RAIL_CENTER_OFFSET_M,.73f,.45f,
            -OUTER_TOP_APRON_HALF_WIDTH_M,.62f,.45f, OUTER_TOP_APRON_HALF_WIDTH_M,.62f,.45f
        };
        lineBuffer=buffer(datum); Matrix.multiplyMM(mvp,0,vp,0,identity(),0); GLES20.glUseProgram(program);
        GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0); GLES20.glUniform4f(colorLoc,.95f,.78f,.22f,1); GLES20.glLineWidth(3);
        GLES20.glEnableVertexAttribArray(posLoc); GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,lineBuffer); GLES20.glDrawArrays(GLES20.GL_LINES,0,datum.length/3); GLES20.glDisableVertexAttribArray(posLoc);
        for(Part p:parts){ if(!p.id.startsWith("LANDMARK_") && !p.id.startsWith("AC_")) continue; drawMarker(p.x,p.y,p.z,.035f,.25f,.85f,.78f); }
    }
    private void drawMarker(float x,float y,float z,float size,float r,float g,float b){
        Matrix.setIdentityM(model,0); Matrix.translateM(model,0,x,y,z); Matrix.scaleM(model,0,size,size,size); Matrix.multiplyMM(mvp,0,vp,0,model,0);
        GLES20.glUseProgram(program); GLES20.glUniformMatrix4fv(mvpLoc,1,false,mvp,0); GLES20.glUniform4f(colorLoc,r,g,b,1); GLES20.glEnableVertexAttribArray(posLoc); GLES20.glVertexAttribPointer(posLoc,3,GLES20.GL_FLOAT,false,0,cube); GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,36); GLES20.glDisableVertexAttribArray(posLoc);
    }

    private void performPick(float sx,float sy){ Part best=null;float bestD=90f;for(Part p:parts){if(!visible(p.category))continue;float[] v={p.x,p.y,p.z,1},clip=new float[4];Matrix.multiplyMV(clip,0,vp,0,v,0);if(clip[3]<=0)continue;float px=(clip[0]/clip[3]*.5f+.5f)*width,py=(.5f-clip[1]/clip[3]*.5f)*height;float d=(float)Math.hypot(px-sx,py-sy);if(d<bestD){bestD=d;best=p;}}selected=best;if(best!=null)info.accept(best.id+"  •  "+best.name+"\n"+best.note); }
    public void pick(float x,float y){pickX=x;pickY=y;}
    public void setFilter(int value){filter=value;selected=null;}
    public void setWindowsDetailParity(boolean enabled){windowsDetailParity=enabled;info.accept(enabled?"WINDOWS DETAIL PARITY ON — full recognition geometry, fin fields, fan blades, engine runners and service hardware":"Android detail mode — lightweight recognition geometry");}
    public void setValidationMode(boolean enabled){validationMode=enabled;info.accept(enabled?"GEOMETRY VALIDATION ON — datum/centerline/anchor markers shown; selected source is reported below":"Geometry validation hidden");}
    public String describeView(){return "cameraPresetYaw="+yaw+" pitch="+pitch+" distance="+distance+" targetVehicleApprox=[forward="+(-targetZ)+", left="+(-targetX)+", up="+targetY+"]";}
    public void orbit(float dx,float dy){yaw-=dx*.16f;pitch=Math.max(-5,Math.min(72,pitch-dy*.13f));}
    public void zoom(float factor){distance=Math.max(2.0f,Math.min(10f,distance/factor));}
    public void resetCamera(){setCameraPreset(0);}
    public void setCameraPreset(int preset){
        // Matches the locked REFERENCE_PHOTO_REPLICA camera generated from the
        // millimetre manifest.  Android receives the same world-space pose;
        // only the OpenGL projection implementation differs.
        if(preset==1){
            targetX=ModelManifest.PHOTO_CAMERA_TARGET_WORLD_X_M;
            targetY=ModelManifest.PHOTO_CAMERA_TARGET_WORLD_Y_M;
            targetZ=ModelManifest.PHOTO_CAMERA_TARGET_WORLD_Z_M;
            float dx=ModelManifest.PHOTO_CAMERA_POSITION_WORLD_X_M-targetX;
            float dy=ModelManifest.PHOTO_CAMERA_POSITION_WORLD_Y_M-targetY;
            float dz=ModelManifest.PHOTO_CAMERA_POSITION_WORLD_Z_M-targetZ;
            distance=(float)Math.sqrt(dx*dx+dy*dy+dz*dz);
            pitch=(float)Math.toDegrees(Math.asin(dy/distance));
            yaw=(float)Math.toDegrees(Math.atan2(dx,-dz));
        }
        else if(preset==2){yaw=-43;pitch=18;distance=1.25f;targetX=-.40f;targetY=.50f;targetZ=-.30f;}
        else if(preset==3){yaw=32;pitch=15;distance=1.35f;targetX=.38f;targetY=.62f;targetZ=1.12f;}
        else {yaw=0;pitch=23;distance=4.8f;targetX=0;targetY=.65f;targetZ=0;}
    }

    public void showWalkthroughStep(int step){
        String id;
        switch(step){
            case 0: id="AC_RECEIVER_DRIER"; filter=AC; setCameraPreset(1); break;
            case 1: id="AC_HIGH_SERVICE_PORT"; filter=HIGH; setCameraPreset(1); break;
            case 2: id="AC_COMPRESSOR"; filter=AC; setCameraPreset(2); break;
            case 3: id="AC_CONDENSER"; filter=HIGH; setCameraPreset(1); break;
            case 4: id="AC_EVAPORATOR"; filter=AC; setCameraPreset(3); break;
            case 5: id="AC_RECEIVER_DRIER"; filter=AC; setCameraPreset(1); break;
            case 6: id="AC_DISCHARGE_PORT"; filter=HIGH; setCameraPreset(2); break;
            case 7: id="AC_RECEIVER_DRIER"; filter=HIGH; setCameraPreset(1); break;
            case 8: id="AC_LOW_SERVICE_PORT"; filter=AC; setCameraPreset(1); break;
            default: id="AC_HIGH_SERVICE_PORT"; filter=AC; setCameraPreset(1); break;
        }
        selected=findPart(id);
    }

    private Part findPart(String id){
        for(Part p:parts) if(p.id.equals(id)) return p;
        return null;
    }

    private void buildModel(){
        float[] body={.64f,.67f,.65f,1},bodyEdge={.30f,.35f,.35f,1},metal={.67f,.71f,.72f,1},aluminum={.78f,.82f,.83f,1},dark={.08f,.11f,.13f,1},rubber={.04f,.055f,.065f,1},glass={.35f,.57f,.68f,.62f},fin={.38f,.46f,.49f,1},high={1f,.56f,.12f,1},low={.20f,.60f,1f,1},coolant={.18f,.45f,.78f,1},wire={.90f,.73f,.20f,1},hvac={.48f,.42f,.80f,1};

        // Vehicle, engine and access landmarks.
        box("LANDMARK_BODY_SHELL","UCF10 body shell",LANDMARK,-1.15f,0,.43f,4.35f,1.78f,.24f,body,"Recognizable first-generation LS400 service shell.");
        box("LANDMARK_FRONT_BUMPER","Front bumper and reinforcement",LANDMARK,FRONT_BUMPER_FORWARD_M,0,.42f,.34f,1.98f,.25f,body,"Front access boundary below the corrected condenser stack.");
        box("LANDMARK_GRILLE","Upper grille",LANDMARK,1.285f,0,.65f,.08f,.60f,.27f,dark,"Sightline toward the condenser and fan pair.");
        box("LANDMARK_PASSENGER_HEADLIGHT","Passenger-side headlight",LANDMARK,1.155f,-.72f,.66f,.20f,.47f,.25f,new float[]{.85f,.91f,.90f,1},"Passenger side is screen-left while facing the car.");
        box("LANDMARK_DRIVER_HEADLIGHT","Driver-side headlight",LANDMARK,1.155f,.72f,.66f,.20f,.47f,.25f,new float[]{.85f,.91f,.90f,1},"Driver side is screen-right while facing the car.");
        box("LANDMARK_HOOD","Articulated hood",LANDMARK,-1.18f,0,1.55f,1.35f,1.68f,.08f,body,"Raised service position with underside volume.").rx=-76;
        box("LANDMARK_HOOD_HINGES","Hood hinges and supports",LANDMARK,-.92f,0,.98f,.20f,1.42f,.08f,metal,"Rear hinge/support landmark.");
        box("LANDMARK_FRONT_FENDERS","Front fenders and outer top aprons",LANDMARK,.02f,0,.62f,2.18f,OUTER_TOP_APRON_HALF_WIDTH_M*2f,.13f,bodyEdge,"Physical 1.820 m vehicle envelope; no display scaling.");
        box("LANDMARK_WINDSHIELD","Windshield",LANDMARK,-1.58f,0,1.16f,.08f,1.55f,.55f,glass,"Rear engine-bay/cowl landmark.").rx=-22;
        box("LANDMARK_COWL","Cowl and wiper plenum (J-j datum)",LANDMARK,-1.110f,0,.94f,.32f,COWL_J_J_SPAN_M,.12f,dark,"RM144U B0-186 J-j hardpoint span: 1.552 m.");
        box("LANDMARK_FIREWALL","Firewall and inner cowl (C-c datum)",LANDMARK,-1.045f,0,.67f,.08f,INNER_COWL_C_C_SPAN_M,.72f,metal,"RM144U B0-186 C-c hardpoint span: 1.494 m.");
        box("LANDMARK_DASHBOARD","Dashboard volume",LANDMARK,-1.55f,0,.82f,.70f,1.58f,.42f,dark,"Cutaway orientation volume.");
        box("LANDMARK_PASSENGER_FOOTWELL","Passenger footwell / glovebox",LANDMARK,-1.56f,-.38f,.40f,.55f,.60f,.50f,new float[]{.14f,.18f,.22f,.55f},"Passenger cabin HVAC access volume.");
        box("LANDMARK_RADIATOR_SUPPORT","Radiator support (A-a datum)",LANDMARK,RADIATOR_SUPPORT_FORWARD_M,0,.61f,.08f,RADIATOR_SUPPORT_A_A_SPAN_M,.34f,metal,"RM144U B0-186 A-a hardpoint span: 1.509 m at the photo-calibrated front plane.");
        box("LANDMARK_FRONT_FRAME_RAILS","Front frame rails",LANDMARK,-.10f,0,.25f,1.55f,1.20f,.12f,metal,"Structural underbody reference.");
        box("LANDMARK_SPLASH_SHIELDS","Splash shields and undercovers",LANDMARK,.05f,0,.15f,1.65f,1.55f,.06f,dark,"May block lower compressor access.");
        box("LANDMARK_RADIATOR","Engine radiator",LANDMARK,RADIATOR_FORWARD_M,0,.570f,.08f,1.28f,.49f,fin,"Behind the A/C condenser at the corrected rear stack plane.");
        cylinder("LANDMARK_COOLING_FANS","Electric cooling fan pair",LANDMARK,FAN_PLANE_FORWARD_M,0,.575f,.11f,.60f,.60f,dark,"Twin-fan plane between the condenser and radiator support.").rx=90;
        // Compact 1UZ envelope reconstructed from the photo-fit vehicle layout.
        // The lower banks stop at |lateral|=.90 m, leaving real open corridors
        // before the apron-mounted tower edges at roughly |lateral|=1.00 m.
        box("ENGINE_1UZ_FE","1UZ-FE central valley block",LANDMARK,ENGINE_FORWARD_M,0,.535f,.88f,.54f,.145f,new float[]{.24f,.28f,.30f,1},"Low central 1UZ mass; the surrounding bank geometry does not consume tower clearance.");
        box("ENGINE_1UZ_FE","Passenger lower 1UZ V-bank",LANDMARK,-.275f,-.625f,.525f,.98f,.50f,.125f,new float[]{.16f,.20f,.21f,1},"Low passenger bank stays inside the outer-apron corridor.");
        box("ENGINE_1UZ_FE","Driver lower 1UZ V-bank",LANDMARK,-.275f,.635f,.525f,.98f,.50f,.125f,new float[]{.16f,.20f,.21f,1},"Low driver bank stays inside the outer-apron corridor.");
        box("ENGINE_1UZ_FE","Passenger-side 1UZ valve-cover strip",LANDMARK,-.310f,-.590f,.650f,.78f,.270f,.100f,dark,"Short passenger cover leaves the throttle and duct exposed.");
        box("ENGINE_1UZ_FE","Driver-side 1UZ valve-cover strip",LANDMARK,-.310f,.600f,.650f,.80f,.290f,.100f,dark,"Long, narrow driver cover remains clear of the driver strut tower.");
        for(int i=0;i<5;i++){
            float forward=-.550f+i*.140f;
            box("ENGINE_1UZ_FE","Passenger valve-cover cast rib",LANDMARK,forward,-.590f,.710f,.030f,.205f,.016f,metal,"Restrained cast-cover rib.");
            box("ENGINE_1UZ_FE","Driver valve-cover cast rib",LANDMARK,forward,.600f,.710f,.030f,.220f,.016f,metal,"Restrained cast-cover rib.");
        }
        // The reference reads as a rear runner pack and a lower rectangular
        // Lexus badge face, not a tall generic central block.
        box("ENGINE_1UZ_FE","1UZ rear runner-pack base",LANDMARK,-.545f,0,.782f,.490f,.340f,.060f,aluminum,"Rear valley runner-pack base.");
        for(float lateral:new float[]{-.125f,-.075f,-.025f,.025f,.075f,.125f}){
            box("ENGINE_1UZ_FE","1UZ cast intake runner crest",LANDMARK,-.545f,lateral,.858f,.425f,.030f,.050f,new float[]{.78f,.82f,.81f,1},"Broad longitudinal 1UZ runner crest.");
        }
        box("ENGINE_1UZ_FE","1UZ front intake plenum",LANDMARK,-.165f,.005f,.775f,.350f,.290f,.070f,new float[]{.66f,.71f,.70f,1},"Low rectangular front plenum face.");
        box("ENGINE_1UZ_FE","Lexus intake badge panel",LANDMARK,-.165f,.005f,.836f,.248f,.180f,.022f,new float[]{.80f,.84f,.83f,1},"Recognizable low badge panel on the plenum face.");
        box("ENGINE_ACCESSORY_DRIVE","Low timing-cover shelf",LANDMARK,.285f,0,.558f,.290f,.460f,.050f,dark,"Shallow front timing cover leaves the accessory reveal open.");
        cylinder("ENGINE_ACCESSORY_DRIVE","Water-pump hub",LANDMARK,.486f,0,.610f,.075f,.075f,.065f,metal,"Centred water-pump/accessory reveal.").rx=90;
        cylinder("ENGINE_ALTERNATOR","Alternator",LANDMARK,.458f,-.300f,.555f,.160f,.180f,.180f,metal,"Passenger/front accessory landmark in the open lower bay.").rx=90;
        cylinder("ENGINE_POWER_STEERING_PUMP","Power-steering pump",LANDMARK,.485f,.300f,.535f,.150f,.170f,.170f,metal,"Driver/front accessory landmark in the open lower bay.").rx=90;
        // Driver-side photo row is fixed front-to-rear: battery -> fuse -> a
        // low rectangular reserve.  These are separate vehicle anchors, never
        // packed together by a display scale.
        box("LANDMARK_BATTERY","Battery case",LANDMARK,DRIVER_BATTERY_FORWARD_M,DRIVER_BATTERY_LATERAL_M,DRIVER_BATTERY_UP_M,.355f,.455f,.180f,dark,"Driver-front photo anchor: [+.542,+.851,+.590] m.");
        box("LANDMARK_BATTERY","Battery lid and hold-down",LANDMARK,DRIVER_BATTERY_FORWARD_M,DRIVER_BATTERY_LATERAL_M,.692f,.365f,.465f,.035f,new float[]{.06f,.08f,.085f,1},"Shallow top and hold-down distinguish the battery from the fuse housing.");
        cylinder("LANDMARK_BATTERY","Battery positive terminal",LANDMARK,.622f,.741f,.722f,.045f,.045f,.030f,new float[]{.72f,.12f,.10f,1},"Visible positive terminal at the driver-front corner.");
        box("LANDMARK_AIRBOX","Air cleaner lower housing",LANDMARK,AIRBOX_FORWARD_M,AIRBOX_LATERAL_M,AIRBOX_UP_M,.455f,.430f,.155f,dark,"Passenger-front photo anchor; first element of the continuous RH intake path.");
        box("LANDMARK_AIRBOX","Air cleaner stepped lid",LANDMARK,AIRBOX_FORWARD_M+.006f,AIRBOX_LATERAL_M,.660f,.370f,.365f,.036f,new float[]{.055f,.075f,.080f,1},"Low stepped filter-housing lid, not a generic cube.");
        box("LANDMARK_AIRBOX","Air cleaner outlet neck",LANDMARK,.340f,-.645f,.625f,.135f,.150f,.095f,new float[]{.07f,.09f,.095f,1},"Molded outlet from the low passenger-front housing into the AFM.");
        cylinder("LANDMARK_INTAKE_TUBE","Mass air flow meter barrel",LANDMARK,MAF_FORWARD_M,MAF_LATERAL_M,MAF_UP_M,.180f,.145f,.145f,aluminum,"Passenger-front AFM directly downstream of the airbox.").rx=90;
        box("LANDMARK_INTAKE_TUBE","AFM electronics cap",LANDMARK,.204f,-.828f,.724f,.115f,.070f,.085f,dark,"Raised rectangular AFM cap faces the passenger apron.");
        cylinder("LANDMARK_THROTTLE_BODY","Throttle crossbody barrel",LANDMARK,-.286f,-.430f,.802f,.145f,.145f,.310f,aluminum,"Large horizontal cast barrel receiving the passenger-side intake elbow.").rz=90;
        cylinder("LANDMARK_THROTTLE_BODY","Throttle inlet collar",LANDMARK,-.286f,-.585f,.802f,.155f,.155f,.026f,metal,"Clamped black-elbow connection at the throttle barrel.").rz=90;
        box("LANDMARK_THROTTLE_BODY","Passenger-side cast throttle chamber",LANDMARK,-.285f,-.430f,.744f,.420f,.340f,.060f,new float[]{.30f,.35f,.36f,1},"Connected lower cast transition from the duct to the plenum, not a floating horn.");
        box("LANDMARK_ENGINE_BAY_FUSE_BOX","Engine-bay fuse and relay box",LANDMARK,DRIVER_FUSE_FORWARD_M,DRIVER_FUSE_LATERAL_M,DRIVER_FUSE_UP_M,.390f,.350f,.100f,dark,"Driver-side row anchor behind the battery: [+.297,+.902,+.640] m.");
        box("LANDMARK_ENGINE_BAY_FUSE_BOX","Fuse/relay-box lid",LANDMARK,DRIVER_FUSE_FORWARD_M,DRIVER_FUSE_LATERAL_M,.707f,.330f,.290f,.030f,new float[]{.05f,.07f,.075f,1},"Flat labeled-style lid distinct from both battery and coolant reserve.");
        box("LANDMARK_COOLANT_OVERFLOW_RESERVOIR","Shallow rectangular coolant reserve",LANDMARK,DRIVER_COOLANT_RESERVE_FORWARD_M,DRIVER_COOLANT_RESERVE_LATERAL_M,DRIVER_COOLANT_RESERVE_UP_M,.350f,.290f,.084f,new float[]{.72f,.71f,.56f,.92f},"Low opaque rectangular reserve directly behind the fuse box; deliberately not a water-jug silhouette.");
        box("LANDMARK_COOLANT_OVERFLOW_RESERVOIR","Coolant reserve top seam",LANDMARK,DRIVER_COOLANT_RESERVE_FORWARD_M,DRIVER_COOLANT_RESERVE_LATERAL_M,.822f,.275f,.235f,.018f,new float[]{.82f,.80f,.64f,.94f},"Shallow molded top seam on the rectangular reserve.");
        cylinder("LANDMARK_COOLANT_OVERFLOW_CAP","Coolant reserve cap",LANDMARK,-.033f,.967f,.842f,.052f,.052f,.028f,new float[]{.20f,.24f,.26f,1},"Low offset cap on the compact rectangular coolant reserve.");
        cylinder("LANDMARK_SPRING_SUPPORT_B_B_HOLES","Passenger B-b inner-front spring support hole",LANDMARK,-.45f,-B_B_INNER_FRONT_HOLE_OFFSET_M,.70f,.025f,.035f,.035f,metal,"RM144U B0-186 B-b is the 1.050 m inner-front hole pair, not the tower centre.");
        cylinder("LANDMARK_SPRING_SUPPORT_B_B_HOLES","Driver B-b inner-front spring support hole",LANDMARK,-.45f,B_B_INNER_FRONT_HOLE_OFFSET_M,.70f,.025f,.035f,.035f,metal,"RM144U B0-186 B-b is the 1.050 m inner-front hole pair, not the tower centre.");
        box("LANDMARK_INNER_APRON_RAILS","Passenger inner apron rail",LANDMARK,-.02f,-INNER_APRON_RAIL_CENTER_OFFSET_M,.77f,2.00f,.050f,.105f,bodyEdge,"Physical inner-apron rail at -0.720 m.");
        box("LANDMARK_INNER_APRON_RAILS","Driver inner apron rail",LANDMARK,-.02f,INNER_APRON_RAIL_CENTER_OFFSET_M,.77f,2.00f,.050f,.105f,bodyEdge,"Physical inner-apron rail at +0.720 m.");
        box("LANDMARK_OUTER_TOP_APRON_RAILS","Passenger outer top-apron rail",LANDMARK,-.02f,-OUTER_APRON_RAIL_CENTER_OFFSET_M,.74f,2.08f,.060f,.115f,bodyEdge,"Physical outer-apron rail at -0.850 m.");
        box("LANDMARK_OUTER_TOP_APRON_RAILS","Driver outer top-apron rail",LANDMARK,-.02f,OUTER_APRON_RAIL_CENTER_OFFSET_M,.74f,2.08f,.060f,.115f,bodyEdge,"Physical outer-apron rail at +0.850 m.");
        cylinder("LANDMARK_FRONT_STRUT_TOWERS","Passenger front strut-apron dome",LANDMARK,PASSENGER_STRUT_TOWER_FORWARD_M,PASSENGER_STRUT_TOWER_LATERAL_M,.700f,.300f,.320f,.120f,body,"Passenger dome sits on the outer apron edge; clear of the compact 1UZ bank.");
        cylinder("LANDMARK_FRONT_STRUT_TOWERS","Driver front strut-apron dome",LANDMARK,DRIVER_STRUT_TOWER_FORWARD_M,DRIVER_STRUT_TOWER_LATERAL_M,.700f,.300f,.320f,.120f,body,"Driver dome sits on the outer apron edge; clear of the compact 1UZ bank.");
        cylinder("LANDMARK_FRONT_STRUT_TOWERS","Passenger strut top and fastener plate",LANDMARK,PASSENGER_STRUT_TOWER_FORWARD_M,PASSENGER_STRUT_TOWER_LATERAL_M,.772f,.125f,.140f,.028f,metal,"Tower top hardware.");
        cylinder("LANDMARK_FRONT_STRUT_TOWERS","Driver strut top and fastener plate",LANDMARK,DRIVER_STRUT_TOWER_FORWARD_M,DRIVER_STRUT_TOWER_LATERAL_M,.772f,.125f,.140f,.028f,metal,"Tower top hardware.");
        box("LANDMARK_AIR_SUSPENSION_SERVICE_HOUSINGS","Passenger air-suspension service housing",LANDMARK,-.83f,-.72f,.86f,.30f,.29f,.16f,dark,"Rear passenger-side boxed service zone.");
        box("LANDMARK_AIR_SUSPENSION_SERVICE_HOUSINGS","Driver air-suspension service housing",LANDMARK,-.83f,.72f,.86f,.30f,.29f,.16f,dark,"Rear driver-side boxed service zone.");
        box("ENGINE_THROTTLE_CABLE","Throttle cable",LANDMARK,-.12f,-.08f,1.00f,.05f,.05f,.05f,metal,"Cable route above the passenger-side low service fitting into the throttle body.");
        cylinder("LANDMARK_BRAKE_BOOSTER","Brake booster and master cylinder",LANDMARK,BRAKE_BOOSTER_FORWARD_M,BRAKE_BOOSTER_LATERAL_M,BRAKE_BOOSTER_UP_M,.260f,.330f,.330f,dark,"Driver-rear firewall photo anchor.").rx=90;
        cylinder("LANDMARK_BRAKE_BOOSTER","Brake master-cylinder barrel",LANDMARK,-.816f,1.131f,.790f,.180f,.100f,.100f,metal,"Master cylinder projects forward from the booster.").rx=90;

        // Selectable A/C and HVAC components.
        cylinder("AC_COMPRESSOR","A/C compressor",AC,.30f,.40f,.47f,.30f,.30f,.30f,metal,"Low front driver side; cast body and ports. Never flush through it.").rx=90;
        cylinder("AC_COMPRESSOR_CLUTCH","Compressor clutch and pulley",AC,.47f,.40f,.47f,.08f,.32f,.32f,dark,"Front pulley/clutch face.").rx=90;
        box("AC_COMPRESSOR_BRACKET","Compressor mounting bracket",AC,.30f,.40f,.38f,.30f,.34f,.10f,metal,"Mounts compressor to lower front engine.");
        cylinder("AC_DISCHARGE_PORT","Compressor discharge port",HIGH,.30f,.40f,.59f,.07f,.06f,.06f,high,"High-pressure compressor outlet.");
        cylinder("AC_SUCTION_PORT","Compressor suction port",LOW,.27f,.42f,.60f,.08f,.08f,.08f,low,"Low-pressure compressor inlet.");
        box("AC_CONDENSER","A/C condenser",HIGH,CONDENSER_FORWARD_M,0,.555f,.07f,1.26f,.47f,fin,"Thin high-side heat exchanger ahead of the radiator at the corrected front stack plane.");
        cylinder("AC_CONDENSER_INLET","Condenser inlet fitting",HIGH,.925f,.61f,.70f,.08f,.06f,.06f,high,"Receives compressor discharge vapor.");
        cylinder("AC_CONDENSER_OUTLET","Condenser outlet fitting",HIGH,.930f,-.62f,.48f,.08f,.06f,.06f,high,"Sends high-pressure liquid toward receiver-drier.");
        cylinder("AC_RECEIVER_DRIER","Receiver-drier 88470-50010",HIGH,RECEIVER_DRIER_FORWARD_M,RECEIVER_DRIER_LATERAL_M,RECEIVER_DRIER_UP_M,.34f,.12f,.12f,aluminum,"Passenger-side support canister at the radiator-support anchor. Installed retrofit history controls replacement; never flush through it.");
        box("AC_RECEIVER_DRIER_BRACKET","Receiver-drier clamp and bracket",AC,RECEIVER_DRIER_FORWARD_M,-.750f,RECEIVER_DRIER_UP_M,.30f,.05f,.10f,metal,"Clamp and radiator-support mounting point.");
        cylinder("AC_PRESSURE_SWITCH","Pressure switch 88645-50010",HIGH,.930f,RECEIVER_DRIER_LATERAL_M,.790f,.08f,.07f,.07f,wire,"Early-production switch on the receiver top/liquid-pipe block.");
        cylinder("AC_SIGHT_GLASS","Receiver sight glass",HIGH,RECEIVER_DRIER_FORWARD_M,RECEIVER_DRIER_LATERAL_M,.760f,.04f,.05f,.05f,new float[]{.40f,.85f,.90f,.9f},"Original-system inspection feature near receiver top.");
        cylinder("AC_HIGH_SERVICE_PORT","High-side service port",HIGH,.770f,-.720f,.820f,.13f,.09f,.09f,high,"Passenger-front receiver-side liquid pipe A; exact Dec-1989 fitting remains approximate.");
        cylinder("AC_LOW_SERVICE_PORT","Low-side service port",LOW,-.43f,-.34f,.88f,.15f,.11f,.11f,low,"Passenger-side suction assembly below the throttle-cable path; verify physical adapter.");
        box("AC_EXPANSION_VALVE","Expansion valve area",HIGH,-1.00f,-.47f,.72f,.16f,.12f,.16f,high,"Passenger firewall/HVAC case. Never flush through it.");
        box("AC_EVAPORATOR","Evaporator core",LOW,-1.20f,-.41f,.66f,.32f,.52f,.25f,new float[]{.45f,.72f,.78f,1},"Inside passenger-side HVAC case.");
        cylinder("AC_EPR","Evaporator pressure regulator",LOW,-1.00f,-.42f,.67f,.20f,.15f,.15f,low,"December-1989 pre-8/90 EPR at evaporator outlet. Never flush through it.").rx=90;
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
        for(int i=0;i<6;i++) detailBox(AC,RECEIVER_DRIER_FORWARD_M,RECEIVER_DRIER_LATERAL_M,.47f+i*.045f,.025f,.16f,.012f,metal);
        detailBox(LANDMARK,.21f,-.47f,.73f,.25f,.10f,.12f,rubber);
        detailBox(LANDMARK,DRIVER_BATTERY_FORWARD_M,DRIVER_BATTERY_LATERAL_M,.72f,.05f,.360f,.03f,metal);
        for(float side:new float[]{-.70f,.70f}) detailBox(LANDMARK,-.78f,side,1.25f,.85f,.025f,.025f,metal).rx=-58;

        // Windows-parity recognition geometry: wheels, heat-exchanger fin fields,
        // fan shrouds/blades, headlamp ribs, engine ribs/runners, pulleys and service hardware.
        for(float f:new float[]{0f,-2.815f}) for(float l:new float[]{-.83f,.83f}){
            Part tire=detailTorus(LANDMARK,f,l,.33f,.18f,.34f,.34f,new float[]{.035f,.04f,.045f,1}); tire.ry=90;
            Part rim=detailCylinder(LANDMARK,f,l,.33f,.075f,.27f,.27f,metal); rim.rz=90;
            Part hub=detailCylinder(LANDMARK,f,l,.33f,.086f,.09f,.09f,new float[]{.48f,.51f,.52f,1}); hub.rz=90;
            for(int i=0;i<10;i++){double a=i*Math.PI*2/10;detailCylinder(LANDMARK,f,l+(float)Math.cos(a)*.105f,.33f+(float)Math.sin(a)*.105f,.088f,.025f,.025f,dark).rz=90;}
        }
        for(float left:new float[]{-.31f,.31f}){
            Part shroud=detailTorus(LANDMARK,.72f,left,.59f,.055f,.50f,.50f,dark); shroud.rx=90;
            detailCylinder(LANDMARK,.715f,left,.59f,.07f,.13f,.13f,new float[]{.18f,.22f,.24f,1}).rx=90;
            for(int i=0;i<7;i++){double a=i*Math.PI*2/7;Part blade=detailBox(LANDMARK,.70f,left+(float)Math.cos(a)*.10f,.59f+(float)Math.sin(a)*.10f,.025f,.16f,.045f,new float[]{.15f,.18f,.20f,1});blade.rz=(float)Math.toDegrees(a)+28;}
        }
        for(int i=1;i<42;i++) detailBox(HIGH,CONDENSER_FORWARD_M,-.65f+i*(1.30f/42f),.555f,.018f,.006f,.44f,new float[]{.58f,.62f,.63f,1});
        for(int i=1;i<12;i++) detailBox(HIGH,CONDENSER_FORWARD_M+.007f,0,.34f+i*(.44f/12f),.018f,1.22f,.005f,new float[]{.68f,.71f,.71f,1});
        for(float left:new float[]{-.60f,.60f}) for(int i=-5;i<=5;i++) detailBox(LANDMARK,.955f,left+i*.036f,.66f,.125f,.005f,.19f,new float[]{.91f,.95f,.94f,.78f});
        for(float left:new float[]{-.29f,.29f}) for(int i=-4;i<=4;i++) detailBox(LANDMARK,-.25f,left,.79f+i*.002f,.055f,.22f,.012f,new float[]{.62f,.66f,.67f,1}).rz=left<0?-13:13;
        for(int i=-3;i<=3;i++){
            float offset=i*.065f;
            Part runner=detailCylinder(LANDMARK,-.32f+Math.abs(i)*.025f,offset,.88f,.38f,.038f,.038f,aluminum); runner.rx=72; runner.rz=i*4;
        }
        for(int i=0;i<5;i++){Part pulley=detailTorus(LANDMARK,.38f,-.28f+i*.14f,.48f-(i%2)*.10f,.045f,.14f-i*.008f,.14f-i*.008f,dark);pulley.rx=90;}
        for(int i=0;i<6;i++){double a=i*Math.PI*2/6;detailCylinder(AC,.49f,.40f+(float)Math.cos(a)*.10f,.47f+(float)Math.sin(a)*.10f,.075f,.026f,.026f,metal).rx=90;}
        detailBox(AC,.31f,.40f,.63f,.12f,.22f,.07f,metal);
        detailCylinder(HIGH,.31f,.36f,.64f,.08f,.055f,.055f,high);
        detailCylinder(LOW,.28f,.45f,.64f,.09f,.070f,.070f,low);
        for(float z:new float[]{.49f,.58f,.67f,.76f}) detailTorus(AC,RECEIVER_DRIER_FORWARD_M,RECEIVER_DRIER_LATERAL_M,z,.025f,.14f,.14f,metal).rx=90;
        for(float left:new float[]{-.68f,.68f}) for(float f:new float[]{-.45f,-1.0f,-1.45f}) detailBox(LANDMARK,f,left,1.57f,.055f,1.35f,.025f,bodyEdge).rx=-76;
        // Extra engine-bay recognition detail exposed by Windows parity mode:
        // eight plug wells/boots, routed ignition leads and the TPS connector.
        for(float side:new float[]{-.29f,.29f}) for(int i=0;i<4;i++){
            float z=.78f+i*.035f;
            detailCylinder(LANDMARK,-.08f,side,z,.050f,.028f,.028f,new float[]{.90f,.91f,.86f,1}).rx=90;
            detailCylinder(LANDMARK,-.08f,side,z+.035f,.025f,.038f,.038f,dark).rx=90;
            float start=side<0?-.32f:.32f;
            detailCylinder(LANDMARK,-.20f,side*.12f+i*.006f,.92f,.012f,.012f,.012f,dark).rz=side<0?-18:18;
            detailBox(LANDMARK,-.14f,side*.22f+i*.008f,.92f,.10f,.010f,.010f,dark);
        }
        detailBox(LANDMARK,-.22f,-.38f,.38f,.07f,.06f,.09f,dark);
        detailBox(LANDMARK,-.22f,-.43f,.35f,.045f,.05f,.065f,new float[]{.10f,.13f,.14f,1});
        for(int i=0;i<3;i++) detailCylinder(LANDMARK,-.22f-.025f*i,-.47f-.012f*i,.31f,.008f,.008f,.008f,new float[]{.85f-.15f*i,.65f,.18f+.18f*i,1}).rz=90;

        // Seven refrigerant routes plus nine surrounding service routes = 16.
        route("AC_DISCHARGE_LINE",HIGH,high,new float[][]{{.30f,.40f,.58f},{.50f,.38f,.68f},{.72f,.55f,.70f},{.925f,.61f,.70f}});
        route("AC_LIQUID_LINE_CONDENSER_DRIER",HIGH,high,new float[][]{{.93f,-.62f,.48f},{.95f,-.66f,.52f},{.950f,-.690f,.59f}});
        route("AC_LIQUID_LINE_DRIER_FIREWALL",HIGH,high,new float[][]{{.950f,-.690f,.59f},{.930f,-.690f,.79f},{.78f,-.72f,.80f},{.48f,-.75f,.81f},{.10f,-.79f,.82f},{-.28f,-.78f,.84f},{-.62f,-.69f,.85f},{-.82f,-.58f,.80f},{-1.00f,-.47f,.72f}});
        route("AC_EVAPORATOR_FEED_INTERNAL",LOW,low,new float[][]{{-1.00f,-.47f,.72f},{-1.10f,-.45f,.70f},{-1.19f,-.42f,.70f}});
        route("AC_EVAPORATOR_RETURN_INTERNAL",LOW,low,new float[][]{{-1.19f,-.42f,.66f},{-1.09f,-.42f,.67f},{-1.00f,-.42f,.67f}});
        route("AC_SUCTION_LINE",LOW,low,new float[][]{{-1.00f,-.42f,.67f},{-.76f,-.43f,.79f},{-.43f,-.34f,.88f},{-.30f,-.54f,.76f},{-.10f,-.65f,.61f},{.22f,-.67f,.47f},{.54f,-.55f,.37f},{.55f,-.10f,.34f},{.48f,.24f,.42f},{.27f,.42f,.59f}});
        route("AC_EQUALIZER_TUBE",LOW,low,new float[][]{{-1.18f,-.35f,.75f},{-1.10f,-.35f,.77f},{-1.02f,-.40f,.72f}});
        route("HVAC_DRAIN_ROUTE",AC,rubber,new float[][]{{-1.16f,-.42f,.46f},{-1.12f,-.43f,.31f},{-1.06f,-.43f,.20f}});
        route("COOLING_UPPER_HOSE",LANDMARK,coolant,new float[][]{{RADIATOR_FORWARD_M,-.25f,.64f},{.58f,-.33f,.69f},{.22f,-.26f,.80f},{-.04f,-.12f,.78f}});
        route("COOLING_LOWER_HOSE",LANDMARK,coolant,new float[][]{{RADIATOR_FORWARD_M,.25f,.48f},{.48f,.36f,.42f},{.22f,.26f,.35f},{-.06f,.10f,.38f}});
        route("HVAC_HEATER_HOSE_FEED",LANDMARK,coolant,new float[][]{{-.98f,.16f,.79f},{-.62f,.12f,.76f},{-.30f,.08f,.72f}});
        route("HVAC_HEATER_HOSE_RETURN",LANDMARK,coolant,new float[][]{{-.98f,.26f,.75f},{-.62f,.22f,.70f},{-.30f,.18f,.66f}});
        route("ELECTRICAL_AC_HARNESS",LANDMARK,wire,new float[][]{{.58f,-.72f,.82f},{.20f,-.62f,.84f},{-.16f,-.42f,.78f},{.28f,.38f,.62f}});
        route("BRAKE_VACUUM_HOSE",LANDMARK,rubber,new float[][]{{BRAKE_BOOSTER_FORWARD_M,BRAKE_BOOSTER_LATERAL_M,.80f},{-.72f,.80f,.82f},{-.45f,.46f,.80f},{-.30f,.20f,.75f}});
        route("POWER_STEERING_HIGH_PRESSURE",LANDMARK,new float[]{.85f,.32f,.37f,1},new float[][]{{.23f,.25f,.56f},{.05f,.34f,.48f},{-.20f,.40f,.42f}});
        route("POWER_STEERING_RETURN",LANDMARK,new float[]{.85f,.32f,.37f,1},new float[][]{{.62f,.58f,.28f},{.48f,.48f,.30f},{.35f,.41f,.36f},{.20f,.32f,.52f}});
        // RM144U FI-5 / FI-47 topology, ported as one physically continuous
        // installed chain: low airbox outlet -> exposed AFM -> thick ribbed
        // flex -> one smooth elbow -> horizontal throttle barrel/plenum.
        route("INTAKE_AIR_PATH",LANDMARK,rubber,.084f,new float[][]{{.401f,-.630f,.610f},{.354f,-.648f,.620f},{.306f,-.698f,.636f},{.282f,-.728f,.640f}});
        route("INTAKE_AIR_PATH_AFM",LANDMARK,new float[]{.38f,.43f,.44f,1},.103f,new float[][]{{.282f,-.728f,.640f},{MAF_FORWARD_M,MAF_LATERAL_M,MAF_UP_M},{.164f,-.818f,.660f}});
        route("INTAKE_AIR_PATH_RIBBED_FLEX",LANDMARK,rubber,.125f,new float[][]{{.164f,-.818f,.660f},{.102f,-.838f,.704f},{.020f,-.786f,.730f},{-.055f,-.710f,.770f},{-.103f,-.638f,.795f}});
        route("INTAKE_AIR_PATH_SMOOTH_ELBOW",LANDMARK,rubber,.126f,new float[][]{{-.103f,-.638f,.795f},{-.140f,-.580f,.848f},{-.196f,-.532f,.836f},{-.247f,-.545f,.818f},{-.285f,-.586f,.804f}});
        route("INTAKE_AIR_PATH_THROTTLE_NECK",LANDMARK,aluminum,.112f,new float[][]{{-.285f,-.586f,.804f},{-.285f,-.306f,.804f},{-.249f,-.294f,.806f},{-.215f,-.270f,.810f},{THROTTLE_FORWARD_M,THROTTLE_LATERAL_M,THROTTLE_UP_M}});
        route("BODY_APRON_PASSENGER_RAIL",LANDMARK,bodyEdge,new float[][]{{RADIATOR_SUPPORT_FORWARD_M,-1.20f,.71f},{.80f,-1.24f,.80f},{.35f,-1.30f,.88f},{-.10f,-1.31f,.91f},{PASSENGER_STRUT_TOWER_FORWARD_M,PASSENGER_STRUT_TOWER_LATERAL_M,.78f},{-.78f,-1.20f,.83f},{-1.04f,-1.12f,.86f}});
        route("BODY_APRON_DRIVER_RAIL",LANDMARK,bodyEdge,new float[][]{{RADIATOR_SUPPORT_FORWARD_M,1.20f,.71f},{.80f,1.24f,.80f},{.35f,1.30f,.88f},{-.10f,1.31f,.91f},{DRIVER_STRUT_TOWER_FORWARD_M,DRIVER_STRUT_TOWER_LATERAL_M,.78f},{-.78f,1.19f,.83f},{-1.04f,1.11f,.86f}});
        route("ENGINE_THROTTLE_CABLE",LANDMARK,metal,new float[][]{{-.88f,.36f,.95f},{-.66f,.25f,.97f},{-.40f,.08f,.98f},{-.12f,-.08f,1.00f},{.18f,-.18f,.99f},{.30f,-.20f,.97f}});
    }

    private Part box(String id,String name,int cat,float f,float l,float u,float sf,float sl,float su,float[] color,String note){Part p=new Part(id,name,cat,-l,u,-f,sl,su,sf,color,note);parts.add(p);return p;}
    private Part cylinder(String id,String name,int cat,float f,float l,float u,float sf,float sl,float su,float[] color,String note){Part p=box(id,name,cat,f,l,u,sf,sl,su,color,note);p.shape=SHAPE_CYLINDER;return p;}
    private Part detailBox(int cat,float f,float l,float u,float sf,float sl,float su,float[] color){Part p=new Part("DETAIL","Component detail",cat,-l,u,-f,sl,su,sf,color,"");decor.add(p);return p;}
    private Part detailCylinder(int cat,float f,float l,float u,float sf,float sl,float su,float[] color){Part p=detailBox(cat,f,l,u,sf,sl,su,color);p.shape=SHAPE_CYLINDER;return p;}
    private Part detailTorus(int cat,float f,float l,float u,float sf,float sl,float su,float[] color){Part p=detailBox(cat,f,l,u,sf,sl,su,color);p.shape=SHAPE_TORUS;return p;}
    private void route(String id,int cat,float[] color,float[][] pts){route(id,cat,color,0f,pts);}
    private void route(String id,int cat,float[] color,float radius,float[][] pts){float[] xyz=new float[pts.length*3];for(int i=0;i<pts.length;i++){xyz[i*3]=-pts[i][1];xyz[i*3+1]=pts[i][2];xyz[i*3+2]=-pts[i][0];}routes.add(new Route(id,cat,color,radius,xyz));}
    private static FloatBuffer buffer(float[] a){FloatBuffer b=ByteBuffer.allocateDirect(a.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();b.put(a).position(0);return b;}
    private static float[] makeCylinder(int segments){float[] out=new float[segments*12*3];int n=0;for(int i=0;i<segments;i++){double a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;float ax=(float)Math.cos(a),az=(float)Math.sin(a),bx=(float)Math.cos(b),bz=(float)Math.sin(b);float[] v={ax,-1,az,bx,-1,bz,bx,1,bz, ax,-1,az,bx,1,bz,ax,1,az, 0,1,0,bx,1,bz,ax,1,az, 0,-1,0,ax,-1,az,bx,-1,bz};for(float value:v)out[n++]=value;}return out;}
    private static float[] makeTorus(int major,int minor,float ring,float tube){float[] out=new float[major*minor*6*3];int n=0;for(int i=0;i<major;i++)for(int j=0;j<minor;j++){double a=i*Math.PI*2/major,b=(i+1)*Math.PI*2/major,c=j*Math.PI*2/minor,d=(j+1)*Math.PI*2/minor;float[] p0=torusPoint(a,c,ring,tube),p1=torusPoint(b,c,ring,tube),p2=torusPoint(b,d,ring,tube),p3=torusPoint(a,d,ring,tube);for(float[] p:new float[][]{p0,p1,p2,p0,p2,p3})for(float v:p)out[n++]=v;}return out;}
    private static float[] torusPoint(double a,double b,float ring,float tube){float r=ring+tube*(float)Math.cos(b);return new float[]{r*(float)Math.cos(a),r*(float)Math.sin(a),tube*(float)Math.sin(b)};}
    private static float[] identity(){float[] i=new float[16];Matrix.setIdentityM(i,0);return i;}
    private static int shader(int type,String src){int s=GLES20.glCreateShader(type);GLES20.glShaderSource(s,src);GLES20.glCompileShader(s);return s;}
    private static int link(String vs,String fs){int p=GLES20.glCreateProgram();GLES20.glAttachShader(p,shader(GLES20.GL_VERTEX_SHADER,vs));GLES20.glAttachShader(p,shader(GLES20.GL_FRAGMENT_SHADER,fs));GLES20.glLinkProgram(p);return p;}
    private static final class Part{final String id,name,note;final int category;final float x,y,z,sx,sy,sz;final float[] color;float rx,ry,rz;int shape=SHAPE_BOX;Part(String i,String n,int c,float x,float y,float z,float sx,float sy,float sz,float[] col,String note){id=i;name=n;category=c;this.x=x;this.y=y;this.z=z;this.sx=sx;this.sy=sy;this.sz=sz;color=col;this.note=note;}}
    private static final class Route{final String id;final int category;final float[] color,xyz;final float radius;Route(String i,int c,float[] col,float r,float[] x){id=i;category=c;color=col;radius=r;xyz=x;}}
}
