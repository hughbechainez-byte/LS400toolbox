package com.ls400.toolbox;

import android.content.Context;
import android.opengl.GLSurfaceView;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import java.util.function.Consumer;

public final class LS400Surface extends GLSurfaceView {
    private final LS400Renderer renderer;
    private final GestureDetector gestures;
    private final ScaleGestureDetector scale;

    public LS400Surface(Context context, Consumer<String> info) {
        super(context);
        setEGLContextClientVersion(2);
        renderer = new LS400Renderer(info);
        setRenderer(renderer);
        setRenderMode(RENDERMODE_CONTINUOUSLY);
        scale = new ScaleGestureDetector(context,new ScaleGestureDetector.SimpleOnScaleGestureListener(){
            @Override public boolean onScale(ScaleGestureDetector detector){ renderer.zoom(detector.getScaleFactor()); return true; }
        });
        gestures = new GestureDetector(context,new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(MotionEvent e){ return true; }
            @Override public boolean onScroll(MotionEvent a,MotionEvent b,float dx,float dy){ if(!scale.isInProgress()) renderer.orbit(dx,dy); return true; }
            @Override public boolean onSingleTapUp(MotionEvent e){ renderer.pick(e.getX(),e.getY()); return true; }
            @Override public boolean onDoubleTap(MotionEvent e){ renderer.resetCamera(); return true; }
        });
    }
    @Override public boolean onTouchEvent(MotionEvent event){ scale.onTouchEvent(event); gestures.onTouchEvent(event); return true; }
    public void setFilter(int mode){ renderer.setFilter(mode); }
    public void setCameraPreset(int preset){ renderer.setCameraPreset(preset); }
    public void setWindowsDetailParity(boolean enabled){ renderer.setWindowsDetailParity(enabled); }
    public void setValidationMode(boolean enabled){ renderer.setValidationMode(enabled); }
    public String describeView(){ return renderer.describeView(); }
    public void showWalkthroughStep(int step){ renderer.showWalkthroughStep(step); }
}
