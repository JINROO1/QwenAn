package dev.qwenan.runtime

import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/** Asset del manifest: archivo final, su SHA-256 y sus fragmentos. */
data class AssetSpec(val file: String, val size: Long, val sha256: String, val chunks: List<ChunkSpec>)

object Manifest {
    fun parse(json: String): List<AssetSpec> {
        val assets = JSONObject(json).getJSONArray("assets")
        return (0 until assets.length()).map { i ->
            val a = assets.getJSONObject(i)
            val chunks = a.getJSONArray("chunks")
            AssetSpec(
                file = a.getString("file"),
                size = a.getLong("size"),
                sha256 = a.getString("sha256"),
                chunks = (0 until chunks.length()).map { j ->
                    val c = chunks.getJSONObject(j)
                    ChunkSpec(c.getString("name"), c.getLong("size"), c.getString("sha256"))
                },
            )
        }
    }
}

/**
 * Instala los assets del runtime: descarga los fragmentos (reanudables), los reensambla y
 * verifica el archivo final. Es idempotente: un asset ya completo y válido no se vuelve a bajar.
 */
class RuntimeInstaller(
    private val baseUrl: String,
    private val dir: File,
    private val maxAttempts: Int = 6,
    private val sleep: (Long) -> Unit = { Thread.sleep(it) },
) {
    private val partsDir = File(dir, "parts")

    /** Devuelve los archivos instalados por nombre. Lanza IOException si algún asset no valida. */
    fun install(manifestJson: String, onProgress: (String) -> Unit = {}): Map<String, File> {
        dir.mkdirs()
        val result = linkedMapOf<String, File>()
        for (asset in Manifest.parse(manifestJson)) {
            val target = File(dir, asset.file)
            if (isInstalled(target, asset)) {
                onProgress("ya instalado: ${asset.file}")
                result[asset.file] = target
                continue
            }
            onProgress("descargando ${asset.file} (${asset.chunks.size} fragmentos)")
            val downloader = RuntimeDownloader(baseUrl, partsDir, maxAttempts, sleep = sleep)
            val tmp = File(dir, "${asset.file}.part")
            FileOutputStream(tmp, false).use { out ->
                for (chunk in asset.chunks) {
                    val part = downloader.fetchChunk(chunk)
                    part.inputStream().use { it.copyTo(out, 1 shl 20) }
                }
            }
            if (!isInstalled(tmp, asset)) {
                tmp.delete()
                throw IOException("${asset.file}: tamaño o SHA-256 final no coinciden")
            }
            if (!tmp.renameTo(target)) throw IOException("no se pudo mover ${asset.file} a su destino")
            asset.chunks.forEach { File(partsDir, it.name).delete() }
            onProgress("instalado: ${asset.file}")
            result[asset.file] = target
        }
        partsDir.delete()
        return result
    }

    private fun isInstalled(file: File, asset: AssetSpec): Boolean =
        file.exists() && file.length() == asset.size && RuntimeDownloader.sha256(file) == asset.sha256
}
