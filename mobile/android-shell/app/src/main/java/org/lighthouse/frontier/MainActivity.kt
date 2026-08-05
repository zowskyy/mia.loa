package org.lighthouse.frontier

import android.app.Activity
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Frontier native shell — loads libfrontier_app.so (no WebView, no JS runtime).
 */
class MainActivity : Activity() {

    companion object {
        init {
            System.loadLibrary("frontier_app")
        }
    }

  external fun frontierAppMain(): Int
  external fun frontierRuntimeVersion(): String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        val title = TextView(this).apply {
            text = "⚡ Lighthouse Native"
            textSize = 22f
        }
        layout.addView(title)

        val version = TextView(this).apply {
            text = try {
                "Frontier runtime ${frontierRuntimeVersion()}"
            } catch (e: UnsatisfiedLinkError) {
                "Frontier runtime (JNI pending)"
            }
            textSize = 14f
        }
        layout.addView(version)

        setContentView(layout)

        try {
            val code = frontierAppMain()
            if (code != 0) {
                title.text = "App error (code $code)"
            }
        } catch (e: UnsatisfiedLinkError) {
            title.text = "Native library loaded — JNI bridge required for full UI"
        }
    }
}
