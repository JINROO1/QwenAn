package dev.qwenan.runtime

import com.sun.net.httpserver.HttpServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import java.io.File
import java.io.IOException
import java.net.InetSocketAddress
import java.nio.file.Files

class RuntimeDownloaderTest {
    private lateinit var server: HttpServer
    private lateinit var base: String
    private val payload = ByteArray(300_000) { (it * 31 % 251).toByte() }
    private val ranges = mutableListOf<String?>()
    private var failNextWithStatus: Int? = null

    private val chunk by lazy {
        ChunkSpec("part-000", payload.size.toLong(), sha(payload))
    }

    @Before
    fun setUp() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { ex ->
            ranges += ex.requestHeaders.getFirst("Range")
            failNextWithStatus?.let { code ->
                failNextWithStatus = null
                ex.sendResponseHeaders(code, -1)
                ex.close()
                return@createContext
            }
            val range = ex.requestHeaders.getFirst("Range")
            if (range != null && range.startsWith("bytes=")) {
                val start = range.removePrefix("bytes=").removeSuffix("-").toInt()
                val body = payload.copyOfRange(start, payload.size)
                ex.responseHeaders.add("Content-Range", "bytes $start-${payload.size - 1}/${payload.size}")
                ex.sendResponseHeaders(206, body.size.toLong())
                ex.responseBody.use { it.write(body) }
            } else {
                ex.sendResponseHeaders(200, payload.size.toLong())
                ex.responseBody.use { it.write(payload) }
            }
        }
        server.start()
        base = "http://127.0.0.1:${server.address.port}"
    }

    @After
    fun tearDown() {
        server.stop(0)
    }

    private fun newDir(): File = Files.createTempDirectory("dl").toFile()

    @Test
    fun downloadsAndVerifiesWholeChunk() {
        val dir = newDir()
        val f = RuntimeDownloader(base, dir, sleep = {}).fetchChunk(chunk)
        assertTrue(RuntimeDownloader.isValid(f, chunk))
        assertEquals(listOf<String?>(null), ranges)
    }

    @Test
    fun resumesFromPartialWithRange() {
        val dir = newDir()
        File(dir, chunk.name).writeBytes(payload.copyOfRange(0, 100_000))
        val f = RuntimeDownloader(base, dir, sleep = {}).fetchChunk(chunk)
        assertTrue(RuntimeDownloader.isValid(f, chunk))
        assertEquals(listOf<String?>("bytes=100000-"), ranges)
    }

    @Test
    fun restartsWhenPartialIsCorrupt() {
        val dir = newDir()
        File(dir, chunk.name).writeBytes(ByteArray(100_000) { 7 })
        val f = RuntimeDownloader(base, dir, sleep = {}).fetchChunk(chunk)
        assertTrue(RuntimeDownloader.isValid(f, chunk))
        // Primer intento reanuda (206 con datos erróneos): queda de tamaño completo pero inválido,
        // se descarta y el siguiente intento lo baja completo sin Range.
        assertEquals(listOf<String?>("bytes=100000-", null), ranges)
    }

    @Test
    fun retriesAfterServerError() {
        val dir = newDir()
        failNextWithStatus = 503
        val f = RuntimeDownloader(base, dir, sleep = {}).fetchChunk(chunk)
        assertTrue(RuntimeDownloader.isValid(f, chunk))
        assertEquals(2, ranges.size)
    }

    @Test
    fun failsAfterMaxAttempts() {
        val dir = newDir()
        val wrong = ChunkSpec("part-000", payload.size.toLong(), "0".repeat(64))
        val e = assertThrows(IOException::class.java) {
            RuntimeDownloader(base, dir, maxAttempts = 2, sleep = {}).fetchChunk(wrong)
        }
        assertTrue(e.message!!.contains("part-000"))
    }

    private fun sha(bytes: ByteArray): String {
        val f = File.createTempFile("p", ".bin")
        f.writeBytes(bytes)
        return RuntimeDownloader.sha256(f)
    }
}
