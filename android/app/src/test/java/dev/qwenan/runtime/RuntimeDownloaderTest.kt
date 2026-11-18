package dev.qwenan.runtime

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import java.io.BufferedReader
import java.io.File
import java.io.IOException
import java.io.InputStreamReader
import java.net.ServerSocket
import java.net.Socket
import java.nio.file.Files
import kotlin.concurrent.thread

/** Servidor HTTP/1.1 mínimo (el JDK de Android no trae com.sun.net.httpserver). */
class MiniServer(private val handler: (method: String, range: String?) -> Reply) {
    data class Reply(val status: Int, val headers: Map<String, String> = emptyMap(), val body: ByteArray = ByteArray(0))

    val ranges = mutableListOf<String?>()
    private val server = ServerSocket(0, 50, java.net.InetAddress.getByName("127.0.0.1"))
    val port: Int get() = server.localPort
    @Volatile private var running = true

    init {
        thread(isDaemon = true) {
            while (running) {
                val s = try { server.accept() } catch (e: IOException) { break }
                s.use { handle(it) }
            }
        }
    }

    private fun handle(s: Socket) {
        val reader = BufferedReader(InputStreamReader(s.getInputStream(), Charsets.ISO_8859_1))
        val requestLine = reader.readLine() ?: return
        var range: String? = null
        while (true) {
            val line = reader.readLine() ?: break
            if (line.isEmpty()) break
            if (line.startsWith("Range:", ignoreCase = true)) range = line.substringAfter(":").trim()
        }
        synchronized(ranges) { ranges += range }
        val reply = handler(requestLine.substringBefore(' '), range)
        val out = s.getOutputStream()
        val head = StringBuilder("HTTP/1.1 ${reply.status} X\r\nContent-Length: ${reply.body.size}\r\nConnection: close\r\n")
        reply.headers.forEach { (k, v) -> head.append("$k: $v\r\n") }
        head.append("\r\n")
        out.write(head.toString().toByteArray(Charsets.ISO_8859_1))
        out.write(reply.body)
        out.flush()
    }

    fun close() {
        running = false
        server.close()
    }
}

class RuntimeDownloaderTest {
    private lateinit var server: MiniServer
    private lateinit var base: String
    private val payload = ByteArray(300_000) { (it * 31 % 251).toByte() }
    @Volatile private var failNextWith: Int? = null

    private val chunk by lazy { ChunkSpec("part-000", payload.size.toLong(), sha(payload)) }

    @Before
    fun setUp() {
        server = MiniServer { _, range ->
            failNextWith?.let { code ->
                failNextWith = null
                return@MiniServer MiniServer.Reply(code)
            }
            if (range != null && range.startsWith("bytes=")) {
                val start = range.removePrefix("bytes=").removeSuffix("-").toInt()
                val body = payload.copyOfRange(start, payload.size)
                MiniServer.Reply(206, mapOf("Content-Range" to "bytes $start-${payload.size - 1}/${payload.size}"), body)
            } else {
                MiniServer.Reply(200, body = payload)
            }
        }
        base = "http://127.0.0.1:${server.port}"
    }

    @After
    fun tearDown() {
        server.close()
    }

    private fun newDir(): File = Files.createTempDirectory("dl").toFile()

    @Test
    fun downloadsAndVerifiesWholeChunk() {
        val f = RuntimeDownloader(base, newDir(), sleep = {}).fetchChunk(chunk)
        assertTrue(RuntimeDownloader.isValid(f, chunk))
        assertEquals(listOf<String?>(null), server.ranges)
    }

    @Test
    fun resumesFromPartialWithRange() {
        val dir = newDir()
        File(dir, chunk.name).writeBytes(payload.copyOfRange(0, 100_000))
        val f = RuntimeDownloader(base, dir, sleep = {}).fetchChunk(chunk)
        assertTrue(RuntimeDownloader.isValid(f, chunk))
        assertEquals(listOf<String?>("bytes=100000-"), server.ranges)
    }

    @Test
    fun restartsWhenPartialIsCorrupt() {
        val dir = newDir()
        File(dir, chunk.name).writeBytes(ByteArray(100_000) { 7 })
        val f = RuntimeDownloader(base, dir, sleep = {}).fetchChunk(chunk)
        assertTrue(RuntimeDownloader.isValid(f, chunk))
        // Primer intento reanuda y produce un fragmento de tamaño completo pero inválido:
        // se descarta y el segundo intento lo baja completo, sin Range.
        assertEquals(listOf<String?>("bytes=100000-", null), server.ranges)
    }

    @Test
    fun retriesAfterServerError() {
        failNextWith = 503
        val f = RuntimeDownloader(base, newDir(), sleep = {}).fetchChunk(chunk)
        assertTrue(RuntimeDownloader.isValid(f, chunk))
        assertEquals(2, server.ranges.size)
    }

    @Test
    fun failsAfterMaxAttempts() {
        val wrong = ChunkSpec("part-000", payload.size.toLong(), "0".repeat(64))
        val e = assertThrows(IOException::class.java) {
            RuntimeDownloader(base, newDir(), maxAttempts = 2, sleep = {}).fetchChunk(wrong)
        }
        assertTrue(e.message!!.contains("part-000"))
    }

    private fun sha(bytes: ByteArray): String {
        val f = File.createTempFile("payload", ".bin")
        f.writeBytes(bytes)
        return RuntimeDownloader.sha256(f)
    }
}
