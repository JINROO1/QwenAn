package dev.qwenan

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.webkit.WebViewAssetLoader
import dev.qwenan.runtime.ProotCommand
import dev.qwenan.runtime.ProotConfig
import dev.qwenan.runtime.RuntimeSetup
import dev.qwenan.runtime.ServeCommand
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom

/**
 * Primer arranque: instala el runtime, lanza `qwen serve` dentro de proot y abre la Web Shell
 * (servida desde los assets del APK) con la conexión preconfigurada.
 */
class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var web: WebView
    private var serve: Process? = null
    private var configured = false

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        status = TextView(this).apply {
            text = "Preparando runtime…"
            textSize = 16f
            setPadding(48, 96, 48, 24)
        }
        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            visibility = View.GONE
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // La Web Shell (https de appassets) habla con el daemon en http://127.0.0.1: solo loopback.
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)

                override fun onPageFinished(view: WebView, url: String) {
                    // Una sola vez: guarda la conexión en localStorage y recarga para que la Web Shell la lea.
                    if (!configured && url.startsWith(ServeCommand.UI_ORIGIN)) {
                        configured = true
                        view.evaluateJavascript(connectionScript(token()), { view.reload() })
                    }
                }
            }
        }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        })
        Thread { start() }.start()
    }

    override fun onDestroy() {
        serve?.destroy()
        super.onDestroy()
    }

    private fun start() {
        try {
            val setup = RuntimeSetup(RuntimeSetup.RELEASE_BASE, filesDir) { msg -> ui { status.text = msg } }
            setup.ensureInstalled()
            ui { status.text = "Arrancando qwen serve…" }
            launchServe(setup.rootfsDir, token())
            ui { status.text = "Esperando al daemon…" }
            waitHealthy()
            ui {
                status.visibility = View.GONE
                web.visibility = View.VISIBLE
                web.loadUrl("${ServeCommand.UI_ORIGIN}/index.html")
            }
        } catch (e: Exception) {
            ui { status.text = "Error: ${e.message}\nRegistro: ${File(filesDir, "serve.log").path}" }
        }
    }

    private fun launchServe(rootfs: File, token: String) {
        val proot = File(applicationInfo.nativeLibraryDir, "libproot.so")
        val tmp = File(cacheDir, "proot").apply { mkdirs() }
        val launch = ProotCommand.build(
            ProotConfig(prootBinary = proot, rootfsDir = rootfs, tmpDir = tmp, home = "/root"),
            ServeCommand.build(token, "/root"),
        )
        val pb = ProcessBuilder(launch.args)
            .directory(launch.workDir)
            .redirectErrorStream(true)
            .redirectOutput(File(filesDir, "serve.log"))
        pb.environment().putAll(launch.env)
        serve = pb.start()
    }

    /** Espera a que /health responda 200; falla si el proceso muere antes. */
    private fun waitHealthy() {
        repeat(120) {
            if (serve?.isAlive != true) throw IllegalStateException("qwen serve terminó (código ${serve?.exitValue()})")
            if (healthOk()) return
            Thread.sleep(1_000)
        }
        throw IllegalStateException("qwen serve no respondió en 120 s")
    }

    private fun healthOk(): Boolean = try {
        val conn = URL("http://127.0.0.1:${ServeCommand.PORT}/health").openConnection() as HttpURLConnection
        conn.connectTimeout = 2_000
        conn.readTimeout = 2_000
        conn.responseCode == 200
    } catch (e: Exception) {
        false
    }

    /** Token aleatorio por instalación, guardado en preferencias privadas de la app. */
    private fun token(): String {
        val prefs = getSharedPreferences("qwenan", MODE_PRIVATE)
        prefs.getString("token", null)?.let { return it }
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val t = bytes.joinToString("") { "%02x".format(it) }
        prefs.edit().putString("token", t).apply()
        return t
    }

    private fun connectionScript(token: String): String =
        "localStorage.setItem('qwenan.daemon.v1', JSON.stringify(" +
            "{baseUrl:'http://127.0.0.1:${ServeCommand.PORT}', token:'$token', workspaceCwd:''}));"

    private fun ui(block: () -> Unit) = runOnUiThread(block)
}
