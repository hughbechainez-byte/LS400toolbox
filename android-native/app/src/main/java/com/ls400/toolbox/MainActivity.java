package com.ls400.toolbox;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.content.ContentValues;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private LS400Surface surface;
    private TextView info;
    private ImageView reference;
    private int guideStep;
    private TextView guideLabel;
    private FrameLayout root;
    private LinearLayout photoPanel;
    private TextView photoStatus;
    private Uri pendingCapture;
    private int photoSpot;
    private boolean windowsDetailParity;
    private final List<Uri> photoUris = new ArrayList<>();
    private static final String[] PHOTO_SPOTS = {
        "Front passenger headlight / receiver-drier",
        "Passenger-side engine bay / compressor",
        "Top-down engine / throttle body and TPS",
        "Driver-side engine / spark-plug wiring",
        "Low front / compressor clutch and hoses"
    };
    private static final String[][] GUIDE = {
        {"Decision gate", "Clean system: no flush. Wrong oil/additives: conditional flush. Metal, leak-stop or unknown refrigerant: replace-plan, not generic flushing."},
        {"Recovery gate", "Use certified recovery equipment, identify refrigerant and verify zero pressure. Service ports are not whole-loop flush ports."},
        {"Never flush", "Compressor, receiver/drier, expansion valve, EPR/equalizer, restricted hoses and ineligible condensers stay out of solvent paths."},
        {"Condenser", "Flush only an identified eligible tube-and-fin core. Parallel-flow/multiflow, desiccant-trap or contaminated cores are replace-not-flush."},
        {"Evaporator", "Only after the expansion valve and EPR/control passages are isolated; replace if it cannot be cleaned and dried."},
        {"Bare lines", "Evaluate each isolated section separately: discharge, condenser-to-receiver, receiver-to-firewall, suction. Replace filtered/muffled/restricted hoses."},
        {"Kit flush", "For the selected kit only: flush one eligible isolated component to capture, then purge/dry exactly per its solvent/equipment instructions."},
        {"Reassemble", "New receiver/drier and all approved replacements first; reconnect capped joints with configuration-correct oil and O-rings."},
        {"Vacuum hold", "Engine off: factory RM144U evacuation reaches 750 mmHg / 29.53 inHg, then holds at least five minutes with no gauge change."},
        {"Leak test & charge", "Leak-test the closed system and charge only by the verified R-12 or Lexus R-134a retrofit mass specification."}
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(Color.rgb(8,17,26));
        getWindow().setNavigationBarColor(Color.rgb(8,17,26));
        root = new FrameLayout(this);
        surface = new LS400Surface(this, this::showInfo);
        root.addView(surface, new FrameLayout.LayoutParams(-1,-1));
        reference = new ImageView(this);
        reference.setImageResource(com.ls400.toolbox.R.drawable.ucf10_hood_open_reference);
        reference.setScaleType(ImageView.ScaleType.CENTER_CROP);
        reference.setBackgroundColor(Color.rgb(8,17,26));
        reference.setPadding(dp(5),dp(5),dp(5),dp(5));
        reference.setVisibility(View.GONE);
        FrameLayout.LayoutParams referenceParams = new FrameLayout.LayoutParams(dp(330),dp(330),Gravity.RIGHT|Gravity.CENTER_VERTICAL);
        referenceParams.setMargins(0,dp(55),dp(10),dp(55));
        root.addView(reference,referenceParams);

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.VERTICAL);
        top.setPadding(dp(14),dp(10),dp(14),dp(10));
        top.setBackgroundColor(Color.argb(224,8,17,26));
        TextView title = text("LS400 TOOLBOX  •  NATIVE OFFLINE", 18, Color.WHITE);
        title.setTypeface(null,1);
        top.addView(title);
        TextView subtitle = text("RM144U / EPC map • 49 components • 17 routes • guided service locator", 12, Color.rgb(177,198,211));
        top.addView(subtitle);

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setPadding(0,dp(8),0,0);
        buttons.addView(filterButton("FULL CAR",0));
        buttons.addView(filterButton("A/C SYSTEM",1));
        buttons.addView(filterButton("HIGH SIDE",2));
        buttons.addView(filterButton("LOW SIDE",3));
        top.addView(buttons);
        LinearLayout cameras = new LinearLayout(this);
        cameras.setOrientation(LinearLayout.HORIZONTAL);
        cameras.addView(cameraButton("FULL VIEW",0));
        cameras.addView(cameraButton("ENGINE BAY",1));
        cameras.addView(cameraButton("COMPRESSOR",2));
        cameras.addView(cameraButton("HVAC CUTAWAY",3));
        Button compare = cameraButton("REFERENCE",0);
        compare.setOnClickListener(v -> { boolean show=reference.getVisibility()!=View.VISIBLE; reference.setVisibility(show?View.VISIBLE:View.GONE); showInfo(show?"Reference comparison shown beside the live native 3D view":"Reference comparison hidden"); });
        cameras.addView(compare);
        top.addView(cameras);
        LinearLayout guide = new LinearLayout(this);
        guide.setOrientation(LinearLayout.HORIZONTAL);
        guide.setPadding(0,dp(3),0,0);
        Button previous = cameraButton("◀ STEP",0);
        previous.setOnClickListener(v -> showGuideStep(guideStep-1));
        guide.addView(previous);
        guideLabel = text("1/10  CONFIGURATION", 10, Color.rgb(112,224,203));
        guideLabel.setGravity(Gravity.CENTER);
        guideLabel.setBackgroundColor(Color.rgb(17,61,72));
        LinearLayout.LayoutParams guideTextParams = new LinearLayout.LayoutParams(0,dp(35),2);
        guideTextParams.setMargins(dp(2),dp(3),dp(2),0);
        guideLabel.setLayoutParams(guideTextParams);
        guide.addView(guideLabel);
        Button next = cameraButton("STEP ▶",0);
        next.setOnClickListener(v -> showGuideStep(guideStep+1));
        guide.addView(next);
        top.addView(guide);
        Button photoMatch = cameraButton("PHOTO MATCH",0);
        photoMatch.setOnClickListener(v -> togglePhotoPanel());
        top.addView(photoMatch);
        Button parity = cameraButton("WINDOWS DETAIL: OFF",0);
        parity.setOnClickListener(v -> {
            windowsDetailParity = !windowsDetailParity;
            parity.setText(windowsDetailParity ? "WINDOWS DETAIL: ON" : "WINDOWS DETAIL: OFF");
            surface.setWindowsDetailParity(windowsDetailParity);
        });
        top.addView(parity);
        Button validation = cameraButton("GEOMETRY VALIDATION: OFF",0);
        validation.setOnClickListener(v -> {
            boolean enabled = validation.getText().toString().endsWith("OFF");
            validation.setText(enabled ? "GEOMETRY VALIDATION: ON" : "GEOMETRY VALIDATION: OFF");
            surface.setValidationMode(enabled);
        });
        top.addView(validation);
        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(-1,-2,Gravity.TOP);
        root.addView(top,topParams);

        info = text("Tap a component to identify it. Passenger side is screen-left when facing the car.", 13, Color.WHITE);
        info.setPadding(dp(14),dp(10),dp(14),dp(10));
        info.setBackgroundColor(Color.argb(230,13,30,43));
        FrameLayout.LayoutParams infoParams = new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM);
        infoParams.setMargins(dp(10),0,dp(10),dp(10));
        root.addView(info,infoParams);

        setContentView(root);
        if (android.os.Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController()!=null) {
            getWindow().getInsetsController().hide(WindowInsets.Type.statusBars());
            getWindow().getInsetsController().setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    private void togglePhotoPanel() {
        if (photoPanel != null) {
            root.removeView(photoPanel);
            photoPanel = null;
            return;
        }
        photoPanel = new LinearLayout(this);
        photoPanel.setOrientation(LinearLayout.VERTICAL);
        photoPanel.setPadding(dp(14),dp(12),dp(14),dp(12));
        photoPanel.setBackgroundColor(Color.argb(245,8,17,26));
        TextView heading = text("PHOTO MATCH  •  MODEL REFERENCE INTAKE",16,Color.WHITE);
        heading.setTypeface(null,1); photoPanel.addView(heading);
        TextView equivalent = text("Capture the real area from the shown angle. The matching in-model camera is selected automatically.",12,Color.rgb(177,198,211));
        equivalent.setPadding(0,dp(4),0,dp(8)); photoPanel.addView(equivalent);
        photoStatus = text("TARGET 1/"+PHOTO_SPOTS.length+"  "+PHOTO_SPOTS[photoSpot]+"\nIn-model equivalent: passenger-front service camera",13,Color.rgb(112,224,203));
        photoStatus.setBackgroundColor(Color.rgb(17,61,72)); photoStatus.setPadding(dp(10),dp(8),dp(10),dp(8)); photoPanel.addView(photoStatus);
        LinearLayout actions = new LinearLayout(this); actions.setOrientation(LinearLayout.HORIZONTAL);
        Button previous = cameraButton("PREV",0); previous.setOnClickListener(v -> setPhotoSpot(photoSpot-1)); actions.addView(previous);
        Button next = cameraButton("NEXT",0); next.setOnClickListener(v -> setPhotoSpot(photoSpot+1)); actions.addView(next);
        Button capture = cameraButton("TAKE PHOTO",0); capture.setOnClickListener(v -> takePhoto()); actions.addView(capture);
        Button importButton = cameraButton("IMPORT",0); importButton.setOnClickListener(v -> importPhoto()); actions.addView(importButton);
        photoPanel.addView(actions);
        Button send = cameraButton("SEND PHOTO SET ("+photoUris.size()+")",0); send.setOnClickListener(v -> sharePhotos()); photoPanel.addView(send);
        TextView note = text("Photos stay on-device until you choose SEND. Include a tape measure or known fastener when possible; photos are review evidence, not automatic CAD edits.",11,Color.rgb(210,229,237));
        note.setPadding(0,dp(8),0,0); photoPanel.addView(note);
        FrameLayout.LayoutParams panelParams = new FrameLayout.LayoutParams(dp(520),-2,Gravity.RIGHT|Gravity.CENTER_VERTICAL);
        panelParams.setMargins(0,dp(55),dp(10),dp(55)); root.addView(photoPanel,panelParams);
    }

    private void setPhotoSpot(int requested) {
        photoSpot = (requested + PHOTO_SPOTS.length) % PHOTO_SPOTS.length;
        int preset = photoSpot == 1 || photoSpot == 2 || photoSpot == 3 ? 1 : photoSpot == 4 ? 2 : 0;
        surface.setCameraPreset(preset);
        if (photoStatus != null) photoStatus.setText("TARGET "+(photoSpot+1)+"/"+PHOTO_SPOTS.length+"  "+PHOTO_SPOTS[photoSpot]+"\nIn-model equivalent: "+(preset==2?"low compressor service camera":preset==1?"engine-bay service camera":"passenger-front service camera"));
    }

    private void takePhoto() {
        String name = "LS400_"+(photoSpot+1)+"_"+System.currentTimeMillis();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME,name+".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE,"image/jpeg");
        values.put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/LS400Toolbox");
        pendingCapture = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);
        if (pendingCapture == null) { showInfo("Could not create a camera photo destination"); return; }
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_OUTPUT,pendingCapture);
        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(intent,41);
    }

    private void importPhoto() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("image/*"); intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,false); intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(intent,42);
    }

    private void sharePhotos() {
        if (photoUris.isEmpty()) { showInfo("Add at least one photo before sending the photo set"); return; }
        Intent send = new Intent(Intent.ACTION_SEND_MULTIPLE); send.setType("image/*");
        send.putParcelableArrayListExtra(Intent.EXTRA_STREAM,new ArrayList<>(photoUris));
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        send.setClipData(ClipData.newRawUri("LS400 photo set",photoUris.get(0)));
        startActivity(Intent.createChooser(send,"Send LS400 photo set"));
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if (resultCode != RESULT_OK) { if (requestCode==41 && pendingCapture!=null) getContentResolver().delete(pendingCapture,null,null); return; }
        Uri uri = requestCode==41 ? pendingCapture : data == null ? null : data.getData();
        if (uri != null) { photoUris.add(uri); writePhotoManifest(uri); if (photoPanel != null) showInfo("Added photo for "+PHOTO_SPOTS[photoSpot]+". Coordinates saved with the capture. Total queued: "+photoUris.size()); }
        pendingCapture = null;
    }

    private void writePhotoManifest(Uri photoUri) {
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME,"LS400_photo_coordinates.txt");
            values.put(MediaStore.Downloads.MIME_TYPE,"text/plain");
            values.put(MediaStore.Downloads.RELATIVE_PATH,"Download/LS400Toolbox");
            Uri out = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
            if(out==null) return;
            try(OutputStream stream=getContentResolver().openOutputStream(out)){
                String text="LS400 Toolbox photo evidence\n"+
                    "target="+PHOTO_SPOTS[photoSpot]+"\n"+
                    "photo_uri="+photoUri+"\n"+
                    "view="+surface.describeView()+"\n"+
                    "truth_status=photo_observed; coordinates are camera-view metadata, not an automatic geometry edit\n";
                stream.write(text.getBytes(StandardCharsets.UTF_8));
            }
            photoUris.add(out);
        } catch(Exception ignored) { showInfo("Photo saved, but the coordinate manifest could not be written."); }
    }

    private Button filterButton(String label, int mode) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(11);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(Color.rgb(17,61,72));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0,dp(44),1);
        p.setMargins(dp(2),0,dp(2),0);
        button.setLayoutParams(p);
        button.setOnClickListener(v -> { surface.setFilter(mode); showInfo(mode==0?"Complete vehicle orientation view":mode==1?"Complete A/C system isolated":mode==2?"HIGH side isolated — orange route":"LOW side isolated — blue route"); });
        return button;
    }

    private Button cameraButton(String label, int preset) {
        Button button = new Button(this);
        button.setText(label); button.setTextSize(9); button.setTextColor(Color.rgb(210,229,237));
        button.setBackgroundColor(Color.rgb(24,43,55));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0,dp(35),1);
        p.setMargins(dp(2),dp(3),dp(2),0); button.setLayoutParams(p);
        button.setOnClickListener(v -> { surface.setCameraPreset(preset); showInfo(label+" service camera"); });
        return button;
    }

    private TextView text(String value, float size, int color) {
        TextView view = new TextView(this);
        view.setText(value); view.setTextSize(size); view.setTextColor(color);
        return view;
    }

    private void showInfo(String value) { runOnUiThread(() -> info.setText(value)); }
    private void showGuideStep(int requested) {
        guideStep = Math.max(0, Math.min(GUIDE.length-1, requested));
        String[] step = GUIDE[guideStep];
        guideLabel.setText((guideStep+1)+"/"+GUIDE.length+"  "+step[0].toUpperCase());
        surface.showWalkthroughStep(guideStep);
        showInfo("STEP "+(guideStep+1)+" — "+step[0]+"\n"+step[1]+"\nLocator only; recovery, zero-pressure verification and the factory procedure govern any opening or flush decision.");
    }
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    @Override protected void onPause(){ super.onPause(); surface.onPause(); }
    @Override protected void onResume(){ super.onResume(); surface.onResume(); }
}
