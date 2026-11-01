package com.xinyao.cadviewer;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(XinyaoFilesPlugin.class);
        super.onCreate(savedInstanceState);
        XinyaoFilesPlugin.deliver(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        XinyaoFilesPlugin.deliver(this, intent);
    }
}
