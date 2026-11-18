package dev.qwenan

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

/** Pantalla provisional: el WebView y el lanzador de proot llegan en pasos posteriores. */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            text = "QwenAn: runtime pendiente de instalación"
            textSize = 18f
            setPadding(48, 96, 48, 48)
        })
    }
}
