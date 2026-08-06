package com.ls400.toolbox;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private LS400Surface surface;
    private TextView info;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(Color.rgb(8,17,26));
        getWindow().setNavigationBarColor(Color.rgb(8,17,26));
        FrameLayout root = new FrameLayout(this);
        surface = new LS400Surface(this, this::showInfo);
        root.addView(surface, new FrameLayout.LayoutParams(-1,-1));

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.VERTICAL);
        top.setPadding(dp(14),dp(10),dp(14),dp(10));
        top.setBackgroundColor(Color.argb(224,8,17,26));
        TextView title = text("LS400 TOOLBOX  •  NATIVE OFFLINE", 18, Color.WHITE);
        title.setTypeface(null,1);
        top.addView(title);
        TextView subtitle = text("1990 UCF10 A/C service locator  •  drag to orbit  •  pinch to zoom  •  tap a part", 12, Color.rgb(177,198,211));
        top.addView(subtitle);

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setPadding(0,dp(8),0,0);
        buttons.addView(filterButton("FULL CAR",0));
        buttons.addView(filterButton("A/C SYSTEM",1));
        buttons.addView(filterButton("HIGH SIDE",2));
        buttons.addView(filterButton("LOW SIDE",3));
        top.addView(buttons);
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

    private TextView text(String value, float size, int color) {
        TextView view = new TextView(this);
        view.setText(value); view.setTextSize(size); view.setTextColor(color);
        return view;
    }

    private void showInfo(String value) { runOnUiThread(() -> info.setText(value)); }
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    @Override protected void onPause(){ super.onPause(); surface.onPause(); }
    @Override protected void onResume(){ super.onResume(); surface.onResume(); }
}
