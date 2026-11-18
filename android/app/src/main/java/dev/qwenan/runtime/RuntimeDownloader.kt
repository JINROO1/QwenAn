package dev.qwenan.runtime

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Un fragmento del manifest: nombre, tamaño y SHA-256 esperados. */
data class ChunkSpec(val name: String, val size: Long, val sha256: String)

/** Descarga reanudable de fragmentos anónimos con verificación SHA-256 por fragmento. */
class RuntimeDownloader(
    private val baseUrl: String,
    private val dir: File,
    private val maxAttempts: Int = 6,
    private val backoffMs: (Int) -> Long = { attempt -> minOf(1000L shl attempt, 30_000L) },
    private val sleep: (Long) -> Unit = { Thread.sleep(it) },
) {
    init {
        dir.mkdirs()
    }

    /**
     * Devuelve el fragmento ya verificado en [dir]. Reanuda con HTTP Range si quedó un parcial.
     * Lanza IOException si tras [maxAttempts] intentos no hay un fragmento válido.
     */
    fun fetchChunk(chunk: ChunkSpec): File {
        val dest = File(dir, chunk.name)
        var lastError: String = "sin intentos"
        for (attempt in 1..maxAttempts) {
            if (isValid(dest, chunk)) return dest
            if (dest.exists() && dest.length() > chunk.size) dest.delete()
            val have = if (dest.exists()) dest.length() else 0L
            try {
                download(chunk, dest, have)
            } catch (e: IOException) {
                lastError = e.message ?: e.javaClass.simpleName
            }
            if (isValid(dest, chunk)) return dest
            if (lastError == "sin intentos") lastError = "tamaño o SHA-256 no coinciden"
            // Un fragmento de tamaño completo con SHA-256 erróneo está corrupto: se descarta.
            if (dest.exists() && dest.length() >= chunk.size) dest.delete()
            if (attempt < maxAttempts) sleep(backoffMs(attempt))
        }
        throw IOException("no se pudo descargar ${chunk.name}: $lastError")
    }

    private fun download(chunk: ChunkSpec, dest: File, have: Long) {
        val conn = URL("$baseUrl/${chunk.name}").openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 30_000
            conn.readTimeout = 60_000
            conn.setRequestProperty("User-Agent", "qwenan-runtime")
            if (have > 0) conn.setRequestProperty("Range", "bytes=$have-")
            val code = conn.responseCode
            val append = code == HttpURLConnection.HTTP_PARTIAL && have > 0
            if (code != HttpURLConnection.HTTP_OK && !append) throw IOException("HTTP $code")
            conn.inputStream.use { input ->
                FileOutputStream(dest, append).use { out -> input.copyTo(out, 64 * 1024) }
            }
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        fun isValid(file: File, chunk: ChunkSpec): Boolean =
            file.exists() && file.length() == chunk.size && sha256(file) == chunk.sha256

        fun sha256(file: File): String {
            val md = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input ->
                val buf = ByteArray(1 shl 20)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    md.update(buf, 0, n)
                }
            }
            return md.digest().joinToString("") { "%02x".format(it) }
        }
    }
}
