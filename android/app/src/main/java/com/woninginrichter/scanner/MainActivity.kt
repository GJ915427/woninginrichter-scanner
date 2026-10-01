package com.woninginrichter.scanner

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(UltraWideCameraPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
