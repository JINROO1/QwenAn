package dev.qwenan.runtime

import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Instalación de primera vez: manifest → fragmentos verificados → rootfs, Node y Qwen Code.
 * Layout final dentro de [root]:
 *   rootfs/            distro Ubuntu noble arm64 (raíz de proot)
 *   rootfs/opt/qwen/node/bin/node
 *   rootfs/opt/qwen/src/packages/cli/dist/index.js
 */
class RuntimeSetup(
    private val baseUrl: String,
    private val filesDir: File,
    private val onProgress: (String) -> Unit = {},
) {
    val rootfsDir: File get() = File(filesDir, "rootfs")
    private val marker: File get() = File(filesDir, "runtime-installed-v1")
    private val downloadDir: File get() = File(filesDir, "dl")

    fun isInstalled(): Boolean = marker.exists()

    fun ensureInstalled() {
        if (isInstalled()) return
        filesDir.mkdirs()
        onProgress("descargando manifest")
        val manifest = fetchText("$baseUrl/manifest.json")
        val files = RuntimeInstaller(baseUrl, downloadDir).install(manifest, onProgress)

        val rootfsArchive = pick(files, ROOTFS_PREFIX)
        val nodeArchive = pick(files, NODE_PREFIX)
        val qwenArchive = pick(files, QWEN_PREFIX)

        onProgress("extrayendo rootfs")
        rootfsDir.deleteRecursively()
        RuntimeExtractor.extract(rootfsArchive, rootfsDir)

        val qwenDir = File(rootfsDir, "opt/qwen")
        onProgress("extrayendo Node")
        RuntimeExtractor.extract(nodeArchive, qwenDir)
        onProgress("extrayendo Qwen Code")
        RuntimeExtractor.extract(qwenArchive, qwenDir)

        downloadDir.deleteRecursively()
        marker.writeText("ok")
        onProgress("runtime instalado")
    }

    private fun pick(files: Map<String, File>, prefix: String): File =
        files.entries.firstOrNull { it.key.startsWith(prefix) }?.value
            ?: throw IOException("falta el asset $prefix en el manifest")

    private fun fetchText(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 30_000
            conn.readTimeout = 60_000
            conn.setRequestProperty("User-Agent", "qwenan-runtime")
            val code = conn.responseCode
            if (code != HttpURLConnection.HTTP_OK) throw IOException("HTTP $code al bajar $url")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        const val RELEASE_BASE = "https://github.com/JINROO1/QwenAn/releases/download/runtime-v1"
        const val ROOTFS_PREFIX = "qwenan-rootfs-noble-arm64"
        const val NODE_PREFIX = "node-"
        const val QWEN_PREFIX = "qwen-code-"
    }
}

/** Argumentos de `qwen serve` dentro de la distro (rutas de la distro, no del teléfono). */
object ServeCommand {
    const val NODE = "/opt/qwen/node/bin/node"
    const val CLI = "/opt/qwen/src/packages/cli/dist/index.js"
    const val PORT = 4170

    fun build(token: String, workspaceGuest: String): List<String> = listOf(
        NODE, CLI, "serve",
        "--port", PORT.toString(),
        "--hostname", "127.0.0.1",
        "--token", token,
        "--workspace", workspaceGuest,
    )
}
